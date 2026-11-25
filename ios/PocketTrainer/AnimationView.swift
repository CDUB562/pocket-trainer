import AVFoundation
import SwiftUI
import WebKit

/// The step-by-step animation for one exercise step. The drawing engine is shared with the web app
/// (src/anim.js and src/anim-steps.js, bundled as anim.html by build.sh) and runs fully offline.
struct StepAnimation: View {
    let skill: String
    let step: Int
    let dog: String
    @State private var height: CGFloat = 360

    var body: some View {
        StepAnimationWeb(skill: skill, step: step, dog: dog, height: $height)
            .frame(height: height)
            .id("\(skill)-\(step)")
    }
}

private struct StepAnimationWeb: UIViewRepresentable {
    let skill: String
    let step: Int
    let dog: String
    @Binding var height: CGFloat

    func makeCoordinator() -> Coordinator { Coordinator(height: $height) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.userContentController.add(context.coordinator, name: "height")
        config.userContentController.add(context.coordinator, name: "voice")
        let web = WKWebView(frame: .zero, configuration: config)
        context.coordinator.web = web
        web.isOpaque = false
        web.backgroundColor = .clear
        web.scrollView.backgroundColor = .clear
        web.scrollView.isScrollEnabled = false
        if let file = Bundle.main.url(forResource: "anim", withExtension: "html"),
           var parts = URLComponents(url: file, resolvingAgainstBaseURL: false) {
            parts.queryItems = [URLQueryItem(name: "skill", value: skill), URLQueryItem(name: "step", value: String(step)), URLQueryItem(name: "dog", value: dog),
                                URLQueryItem(name: "auto", value: UserDefaults.standard.bool(forKey: "listen") ? "1" : "0")]
            if let url = parts.url { web.loadFileURL(url, allowingReadAccessTo: file.deletingLastPathComponent()) }
        }
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}

    static func dismantleUIView(_ web: WKWebView, coordinator: Coordinator) {
        web.configuration.userContentController.removeScriptMessageHandler(forName: "height")
        web.configuration.userContentController.removeScriptMessageHandler(forName: "voice")
        coordinator.stop()
    }

    /// Plays the voice guide's clips here rather than in the web view, so they share the app's audio session
    /// (the marker sounds keep their low delay) and stop the moment the sheet closes.
    @MainActor
    final class Coordinator: NSObject, WKScriptMessageHandler, @preconcurrency AVAudioPlayerDelegate {
        private let height: Binding<CGFloat>
        weak var web: WKWebView?
        private var player: AVAudioPlayer?
        init(height: Binding<CGFloat>) { self.height = height }
        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            if message.name == "height" {
                if let h = message.body as? Double, h > 50 { height.wrappedValue = CGFloat(h) }
                return
            }
            guard let m = message.body as? [String: Any] else { return }
            if let auto = m["auto"] as? Bool { UserDefaults.standard.set(auto, forKey: "listen") }
            if m["stop"] != nil { stop() }
            if let key = m["play"] as? String { play(key) }
        }
        private func play(_ key: String) {
            stop()
            let file = Bundle.main.url(forResource: key, withExtension: "m4a") ?? Bundle.main.url(forResource: key, withExtension: "m4a", subdirectory: "voice")
            guard let file, let p = try? AVAudioPlayer(contentsOf: file) else { done(false); return }
            p.delegate = self
            player = p
            if !p.play() { player = nil; done(false) }
        }
        func stop() { player?.stop(); player = nil }
        private func done(_ ok: Bool) { web?.evaluateJavaScript("PTVoice._done(\(ok))") }
        func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
            guard player === self.player else { return }
            self.player = nil
            done(flag)
        }
    }
}
