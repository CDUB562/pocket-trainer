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
    private var named: [String: AVAudioPCMBuffer] = [:]   // field whistles and sound-ladder sounds
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
        guard let buf = (sound == .yes ? custom : nil) ?? buffers[sound] else { return }
        schedule(buf, volume: 1)
    }

    /// A field whistle (wsit, wcome, wturn) or a sound-ladder sound, optionally quieter for a ladder step.
    func play(named name: String, volume: Float = 1) {
        guard let buf = named[name] else { return }
        schedule(buf, volume: volume)
    }

    private func schedule(_ buf: AVAudioPCMBuffer, volume: Float) {
        ensureRunning()
        let p = players[nextPlayer]
        nextPlayer = (nextPlayer + 1) % players.count
        p.volume = volume
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
        buildFieldSounds()
    }

    // Field whistles and the sound-ladder sounds, synthesized like the web app's so both apps sound the same.
    private func buildFieldSounds() {
        func noise() -> Double { Double.random(in: -1...1) }
        // A pea whistle: about 2.9 kHz with the pea's fast warble.
        func pea(_ t: Double, _ start: Double, _ len: Double) -> Double {
            let u = t - start
            if u < 0 || u > len { return 0 }
            return min(1, u / 0.01) * min(1, (len - u) / 0.015) * (0.65 + 0.35 * sin(2 * .pi * 34 * u)) * sin(2 * .pi * 2900 * u)
        }
        named["wsit"] = render(0.6) { t, _ in pea(t, 0, 0.55) }
        named["wcome"] = render(0.95) { t, _ in (0..<7).reduce(0.0) { $0 + pea(t, Double($1) * 0.13, 0.08) } }
        named["wturn"] = render(0.42) { t, _ in pea(t, 0, 0.12) + pea(t, 0.24, 0.12) }
        named["doorbell"] = render(1.7) { t, _ in
            func ding(_ f: Double, _ s0: Double) -> Double { let u = t - s0; return u < 0 ? 0 : exp(-u / 0.5) * (sin(2 * .pi * f * u) + 0.3 * sin(4 * .pi * f * u)) }
            return ding(659, 0) + ding(523, 0.55)
        }
        // Brown noise (a running sum, kept from drifting) for traffic and thunder.
        var brown = 0.0
        func rumble() -> Double { brown = (brown + 0.02 * noise()) * 0.997; return brown }
        named["traffic"] = render(4) { t, _ in rumble() * exp(-pow((t - 2) / 0.9, 2)) * 3 }
        named["thunder"] = render(4) { t, _ in
            let env = min(1, t / 0.25) * exp(-t / 1.3) * (1 + 0.5 * sin(2 * .pi * 1.7 * t))
            return rumble() * env * 4
        }
        // Fireworks: three bangs, each with a crackle tail.
        func bang(_ t: Double, _ s0: Double) -> Double {
            let u = t - s0
            if u < 0 { return 0 }
            let crackle = u > 0.15 && Double.random(in: 0...1) < 0.02 ? noise() * exp(-(u - 0.15) / 0.5) : 0
            return noise() * exp(-u / 0.07) + 0.6 * sin(2 * .pi * 55 * u) * exp(-u / 0.12) + crackle
        }
        named["fireworks"] = render(2.6) { t, _ in bang(t, 0) + 0.8 * bang(t, 0.8) + 0.9 * bang(t, 1.5) }
        // A duck call: three nasal quacks with a falling pitch.
        func quack(_ t: Double, _ s0: Double) -> Double {
            let u = t - s0
            if u < 0 || u > 0.2 { return 0 }
            let f = 420 - 220 * u, ph = (f * u).truncatingRemainder(dividingBy: 1)
            return min(1, u / 0.01) * min(1, (0.2 - u) / 0.04) * ((2 * ph - 1) * 0.7 + 0.3 * sin(2 * .pi * 3 * f * u))
        }
        named["duck"] = render(1.1) { t, _ in quack(t, 0) + quack(t, 0.32) + quack(t, 0.62) }
        // A gunshot: a sharp noise crack, a low thump and a short echo.
        named["gun"] = render(1.4) { t, _ in noise() * (exp(-t / 0.035) + 0.18 * exp(-t / 0.5)) + 0.9 * sin(2 * .pi * 60 * t) * exp(-t / 0.09) }
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
