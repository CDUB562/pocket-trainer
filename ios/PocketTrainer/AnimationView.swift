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
        let web = WKWebView(frame: .zero, configuration: config)
        web.isOpaque = false
        web.backgroundColor = .clear
        web.scrollView.backgroundColor = .clear
        web.scrollView.isScrollEnabled = false
        if let file = Bundle.main.url(forResource: "anim", withExtension: "html"),
           var parts = URLComponents(url: file, resolvingAgainstBaseURL: false) {
            parts.queryItems = [URLQueryItem(name: "skill", value: skill), URLQueryItem(name: "step", value: String(step)), URLQueryItem(name: "dog", value: dog)]
            if let url = parts.url { web.loadFileURL(url, allowingReadAccessTo: file.deletingLastPathComponent()) }
        }
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}

    static func dismantleUIView(_ web: WKWebView, coordinator: Coordinator) {
        web.configuration.userContentController.removeScriptMessageHandler(forName: "height")
    }

    final class Coordinator: NSObject, WKScriptMessageHandler {
        private let height: Binding<CGFloat>
        init(height: Binding<CGFloat>) { self.height = height }
        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            if let h = message.body as? Double, h > 50 { height.wrappedValue = CGFloat(h) }
        }
    }
}
