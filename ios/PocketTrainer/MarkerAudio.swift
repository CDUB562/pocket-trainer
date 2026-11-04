import AVFoundation

enum Sound: String, CaseIterable {
    case yes, toss, keep, free, recall
}

/// Every sound is rendered once into a buffer at launch, and four player nodes stay running,
/// so a mark is one buffer schedule: no decoding, no file I/O, no node start-up on the tap.
final class MarkerAudio {
    static let shared = MarkerAudio()

    private let engine = AVAudioEngine()
    private let format = AVAudioFormat(standardFormatWithSampleRate: 48_000, channels: 1)!
    private var buffers: [Sound: AVAudioPCMBuffer] = [:]
    private var custom: AVAudioPCMBuffer?
    private var players: [AVAudioPlayerNode] = []
    private var nextPlayer = 0
    private var observers: [NSObjectProtocol] = []
    private var recorder: AVAudioRecorder?

    var hasCustom: Bool { custom != nil }
    var volume: Float = 0.8 { didSet { engine.mainMixerNode.outputVolume = volume } }

    static var customURL: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("marker.caf")
    }

    /// True when sound goes to Bluetooth, which adds up to 200 ms: enough to mark the wrong moment.
    var outputIsBluetooth: Bool {
        AVAudioSession.sharedInstance().currentRoute.outputs.contains {
            [.bluetoothA2DP, .bluetoothLE, .bluetoothHFP].contains($0.portType)
        }
    }

    private init() {
        configureSession()
        buildSounds()
        for _ in 0..<4 {
            let p = AVAudioPlayerNode()
            engine.attach(p)
            engine.connect(p, to: engine.mainMixerNode, format: format)
            players.append(p)
        }
        engine.mainMixerNode.outputVolume = volume
        engine.prepare()
        ensureRunning()
        custom = Self.readMono(Self.customURL, to: format)

        let nc = NotificationCenter.default
        observers.append(nc.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
            // After a phone call or Siri, take the audio session back.
            let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt
            if raw == AVAudioSession.InterruptionType.ended.rawValue { self?.configureSession(); self?.ensureRunning() }
        })
        observers.append(nc.addObserver(forName: .AVAudioEngineConfigurationChange, object: engine, queue: .main) { [weak self] _ in
            self?.ensureRunning()
        })
        observers.append(nc.addObserver(forName: AVAudioSession.mediaServicesWereResetNotification, object: nil, queue: .main) { [weak self] _ in
            self?.configureSession(); self?.ensureRunning()
        })
    }

    /// .playback plays through the silent switch; a 5 ms I/O buffer keeps the tap-to-sound delay low.
    private func configureSession() {
        let s = AVAudioSession.sharedInstance()
        try? s.setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try? s.setPreferredIOBufferDuration(0.005)
        try? s.setActive(true)
    }

    func ensureRunning() {
        if !engine.isRunning {
            do { try engine.start() } catch { return }
        }
        for p in players where !p.isPlaying { p.play() }
    }

    func play(_ sound: Sound) {
        ensureRunning()
        guard let buf = (sound == .yes ? custom : nil) ?? buffers[sound] else { return }
        let p = players[nextPlayer]
        nextPlayer = (nextPlayer + 1) % players.count
        p.scheduleBuffer(buf, at: nil, options: .interrupts, completionHandler: nil)
        if !p.isPlaying { p.play() }
    }

    // MARK: Built-in sounds

    private func render(_ seconds: Double, _ fn: (Double, Double) -> Double) -> AVAudioPCMBuffer {
        let sr = format.sampleRate, n = AVAudioFrameCount(seconds * sr)
        let b = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: n)!
        b.frameLength = n
        let d = b.floatChannelData![0]
        var peak: Float = 0
        for i in 0..<Int(n) {
            let v = Float(fn(Double(i) / sr, sr))
            d[i] = v
            peak = max(peak, abs(v))
        }
        if peak > 0 { for i in 0..<Int(n) { d[i] *= 0.95 / peak } }
        return b
    }

    private func buildSounds() {
        // A box-clicker transient: a ringing metal tick plus a burst of noise, gone in a few ms.
        func tick(_ t: Double, _ f: Double, _ decay: Double) -> Double {
            t < 0 ? 0 : exp(-t / decay) * (0.6 * sin(2 * .pi * f * t) + 0.4 * Double.random(in: -1...1))
        }
        func note(_ t: Double, _ f: Double, _ start: Double, _ len: Double) -> Double {
            let u = t - start
            if u < 0 || u > len { return 0 }
            return min(1, u / 0.005) * min(1, (len - u) / 0.03) * sin(2 * .pi * f * u)
        }
        buffers[.yes] = render(0.09) { t, _ in tick(t, 2600, 0.004) + 0.7 * tick(t - 0.045, 1900, 0.005) }
        buffers[.toss] = render(0.14) { t, _ in tick(t, 3600, 0.003) + tick(t - 0.08, 4300, 0.003) }
        buffers[.keep] = render(0.12) { t, _ in 0.5 * sin(2 * .pi * 1000 * t) * exp(-t / 0.03) }
        buffers[.free] = render(0.42) { t, _ in note(t, 880, 0, 0.14) + note(t, 587, 0.17, 0.24) }
        // Recall: a rising three-note whistle with a little vibrato, played twice.
        let notes: [Double] = [1760, 2217, 2637], len = 0.2, gap = 0.04
        let pass = Double(notes.count) * (len + gap) + 0.12
        var phase = 0.0
        buffers[.recall] = render(pass * 2) { t, sr in
            let tp = t.truncatingRemainder(dividingBy: pass)
            let k = Int(tp / (len + gap)), u = tp - Double(k) * (len + gap)
            if k >= notes.count || u > len { return 0 }
            let f = notes[k] * (1 + 0.015 * sin(2 * .pi * 6 * t))
            phase += 2 * .pi * f / sr
            return min(1, u / 0.01) * min(1, (len - u) / 0.02) * sin(phase)
        }
    }

    // MARK: Your own marker

    /// Records 2 seconds from the microphone, trims the silence before the word, and keeps it as the Yes sound.
    func recordCustom(completion: @escaping (String) -> Void) {
        AVAudioApplication.requestRecordPermission { granted in
            DispatchQueue.main.async {
                guard granted else {
                    completion("Microphone access is off. Turn it on in Settings, Pocket Trainer, Microphone.")
                    return
                }
                self.startCustomRecording(completion: completion)
            }
        }
    }

    private func startCustomRecording(completion: @escaping (String) -> Void) {
        let s = AVAudioSession.sharedInstance()
        let tmp = FileManager.default.temporaryDirectory.appendingPathComponent("yes-take.caf")
        try? FileManager.default.removeItem(at: tmp)
        let settings: [String: Any] = [
            AVFormatIDKey: kAudioFormatLinearPCM, AVSampleRateKey: 48_000, AVNumberOfChannelsKey: 1,
            AVLinearPCMBitDepthKey: 16, AVLinearPCMIsFloatKey: false,
        ]
        do {
            try s.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker])
            try s.setActive(true)
            let r = try AVAudioRecorder(url: tmp, settings: settings)
            recorder = r
            guard r.record(forDuration: 2) else { throw NSError(domain: "rec", code: 1) }
        } catch {
            configureSession(); ensureRunning()
            completion("Couldn't start the microphone. Close other apps using it and try again.")
            return
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.2) {
            self.recorder?.stop()
            self.recorder = nil
            self.configureSession()
            self.ensureRunning()
            completion(self.useTake(tmp))
        }
    }

    private func useTake(_ url: URL) -> String {
        guard let src = Self.readMono(url, to: format) else { return "Couldn't read the recording. Try again." }
        let d = src.floatChannelData![0], n0 = Int(src.frameLength), sr = format.sampleRate
        var peak: Float = 0
        for i in 0..<n0 { peak = max(peak, abs(d[i])) }
        if peak < 0.02 { return "Didn't hear anything. Hold the phone close and say \"Yes!\" right after tapping." }
        var start = 0
        while start < n0 && abs(d[start]) < peak * 0.08 { start += 1 }
        start = max(0, start - Int(sr * 0.003))
        let n = min(n0 - start, Int(sr * 1.2)), fade = Int(sr * 0.02)
        guard n > 0, let out = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(n)) else { return "Couldn't use that take." }
        out.frameLength = AVAudioFrameCount(n)
        let o = out.floatChannelData![0]
        for i in 0..<n { o[i] = d[start + i] / peak * 0.95 * min(1, Float(n - i) / Float(fade)) }
        do {
            try? FileManager.default.removeItem(at: Self.customURL)
            let f = try AVAudioFile(forWriting: Self.customURL, settings: format.settings, commonFormat: .pcmFormatFloat32, interleaved: false)
            try f.write(from: out)
        } catch {
            custom = out
            return "Using your recording now, but it couldn't be saved for next time."
        }
        custom = out
        play(.yes)
        return "Using your recording for Yes (\(Int(Double(start) / sr * 1000)) ms of silence trimmed)."
    }

    func clearCustom() {
        custom = nil
        try? FileManager.default.removeItem(at: Self.customURL)
    }

    /// Reads any audio file as mono float at the engine's sample rate.
    private static func readMono(_ url: URL, to format: AVAudioFormat) -> AVAudioPCMBuffer? {
        guard FileManager.default.fileExists(atPath: url.path),
              let file = try? AVAudioFile(forReading: url), file.length > 0,
              let inBuf = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: AVAudioFrameCount(file.length))
        else { return nil }
        do { try file.read(into: inBuf) } catch { return nil }
        let inFmt = file.processingFormat
        if inFmt.sampleRate == format.sampleRate && inFmt.channelCount == 1 && inFmt.commonFormat == .pcmFormatFloat32 { return inBuf }
        guard let conv = AVAudioConverter(from: inFmt, to: format) else { return nil }
        let cap = AVAudioFrameCount(Double(inBuf.frameLength) * format.sampleRate / inFmt.sampleRate) + 1024
        guard let out = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: cap) else { return nil }
        var fed = false
        var err: NSError?
        conv.convert(to: out, error: &err) { _, status in
            if fed { status.pointee = .endOfStream; return nil }
            fed = true
            status.pointee = .haveData
            return inBuf
        }
        return err == nil && out.frameLength > 0 ? out : nil
    }
}
