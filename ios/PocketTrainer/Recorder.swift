import AVFoundation
import SwiftUI

struct RecMark: Codable, Equatable {
    var t: Double
    var kind: String
}

/// Films a session with the back camera. Hold the phone at your chest: the screen faces you, the camera faces the dog.
/// Each video is saved with its tap times next to it, so it can be reviewed after the app is closed.
// Recorder state is touched only on the main thread or its own queue.
final class Recorder: NSObject, ObservableObject, AVCaptureFileOutputRecordingDelegate, @unchecked Sendable {
    @Published private(set) var isRecording = false
    @Published private(set) var savedCount = 0

    let session = AVCaptureSession()
    private let output = AVCaptureMovieFileOutput()
    private let queue = DispatchQueue(label: "pocket-trainer.recorder")
    private var configured = false
    private var startUptime: TimeInterval = 0
    private var marks: [RecMark] = []
    /// The video started during the current training session, if any.
    var sessionVideo: String?
    /// Called on the main thread when a video is finished: (saved, reason).
    var onFinish: ((Bool, String) -> Void)?

    static var dir: URL {
        let d = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("Videos", isDirectory: true)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }
    static func videoURL(_ name: String) -> URL { dir.appendingPathComponent(name + ".mov") }
    static func marksURL(_ name: String) -> URL { dir.appendingPathComponent(name + ".json") }
    static func isReady(_ name: String) -> Bool {
        FileManager.default.fileExists(atPath: marksURL(name).path) && FileManager.default.fileExists(atPath: videoURL(name).path)
    }
    static func marks(_ name: String) -> [RecMark] {
        guard let d = try? Data(contentsOf: marksURL(name)) else { return [] }
        return (try? JSONDecoder().decode([RecMark].self, from: d)) ?? []
    }

    enum StartResult { case started, denied, noCamera }

    @MainActor
    func start() async -> StartResult {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: break
        case .notDetermined:
            if !(await AVCaptureDevice.requestAccess(for: .video)) { return .denied }
        default: return .denied
        }
        let ok: Bool = await withCheckedContinuation { cont in
            queue.async {
                guard self.configure() else { cont.resume(returning: false); return }
                if !self.session.isRunning { self.session.startRunning() }
                let name = "session-\(Int(Date().timeIntervalSince1970))"
                DispatchQueue.main.async {
                    self.marks = []
                    self.sessionVideo = name
                    self.queue.async { self.output.startRecording(to: Recorder.videoURL(name), recordingDelegate: self) }
                    cont.resume(returning: true)
                }
            }
        }
        return ok ? .started : .noCamera
    }

    func stop() {
        queue.async { if self.output.isRecording { self.output.stopRecording() } }
    }

    /// Tap times use the touch's own timestamp (seconds since boot), the same clock as the recording start.
    func addMark(_ kind: String, at uptime: TimeInterval) {
        guard isRecording else { return }
        marks.append(RecMark(t: uptime - startUptime, kind: kind))
    }

    private func configure() -> Bool {
        if configured { return true }
        session.beginConfiguration()
        session.sessionPreset = .hd1280x720
        guard let cam = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
              let input = try? AVCaptureDeviceInput(device: cam),
              session.canAddInput(input), session.canAddOutput(output)
        else { session.commitConfiguration(); return false }
        session.addInput(input)
        session.addOutput(output)
        // A long video fills the phone; 10 minutes is far longer than a good session.
        output.maxRecordedDuration = CMTime(seconds: 600, preferredTimescale: 600)
        if let c = output.connection(with: .video), c.isVideoRotationAngleSupported(90) { c.videoRotationAngle = 90 }
        session.commitConfiguration()
        configured = true
        return true
    }

    func fileOutput(_ output: AVCaptureFileOutput, didStartRecordingTo fileURL: URL, from connections: [AVCaptureConnection]) {
        let now = ProcessInfo.processInfo.systemUptime
        DispatchQueue.main.async {
            self.startUptime = now
            self.isRecording = true
        }
    }

    func fileOutput(_ output: AVCaptureFileOutput, didFinishRecordingTo outputFileURL: URL, from connections: [AVCaptureConnection], error: Error?) {
        // Leaving the app, a phone call or the 10-minute cap end the file early; it is still a good video.
        var ok = error == nil
        var reason = "stopped"
        if let e = error as NSError? {
            if let done = e.userInfo[AVErrorRecordingSuccessfullyFinishedKey] as? Bool { ok = done }
            if e.code == AVError.maximumDurationReached.rawValue { reason = "cap" }
        }
        let name = outputFileURL.deletingPathExtension().lastPathComponent
        queue.async { self.session.stopRunning() }
        DispatchQueue.main.async {
            self.isRecording = false
            if ok, let data = try? JSONEncoder().encode(self.marks) {
                try? data.write(to: Recorder.marksURL(name), options: .atomic)
            } else {
                try? FileManager.default.removeItem(at: outputFileURL)
                if self.sessionVideo == name { self.sessionVideo = nil }
            }
            self.marks = []
            Recorder.prune()
            self.savedCount += 1
            self.onFinish?(ok, reason)
        }
    }

    /// Keep the 6 newest videos; older ones are deleted to save space.
    static func prune() {
        let fm = FileManager.default
        guard let files = try? fm.contentsOfDirectory(at: dir, includingPropertiesForKeys: [.creationDateKey]) else { return }
        let movies = files.filter { $0.pathExtension == "mov" }.sorted { $0.lastPathComponent > $1.lastPathComponent }
        for m in movies.dropFirst(6) {
            try? fm.removeItem(at: m)
            try? fm.removeItem(at: m.deletingPathExtension().appendingPathExtension("json"))
        }
    }

    static func eraseAll() {
        try? FileManager.default.removeItem(at: dir)
    }
}

struct CameraPreview: UIViewRepresentable {
    let session: AVCaptureSession

    func makeUIView(context: Context) -> PreviewView {
        let v = PreviewView()
        v.previewLayer.session = session
        v.previewLayer.videoGravity = .resizeAspectFill
        return v
    }

    func updateUIView(_ uiView: PreviewView, context: Context) {}

    final class PreviewView: UIView {
        override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
        var previewLayer: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
    }
}
