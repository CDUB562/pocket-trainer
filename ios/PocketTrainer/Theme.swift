import SwiftUI
import UIKit

extension UIColor {
    convenience init(hex: UInt32) {
        self.init(red: CGFloat((hex >> 16) & 0xff) / 255, green: CGFloat((hex >> 8) & 0xff) / 255, blue: CGFloat(hex & 0xff) / 255, alpha: 1)
    }
}

/// Sun-readable light colors with a faint grass tint, and a matching dark set.
enum Theme {
    private static func dyn(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light) })
    }
    static let bg = dyn(0xeef0ea, 0x111613)
    static let surface = dyn(0xffffff, 0x1b221e)
    static let fg = dyn(0x17201b, 0xeef2ec)
    static let muted = dyn(0x59645d, 0x9aa69e)
    static let line = dyn(0xd3d8cf, 0x2c3530)
    static let accent = dyn(0xe0561a, 0xf06a2c)      // training-dummy orange: the Yes marker
    static let accentInk = dyn(0xffffff, 0x120a05)
    static let toss = dyn(0x2463b8, 0x5b95e6)
    static let keep = dyn(0x3f6b52, 0x6fa784)
    static let warn = dyn(0xa35a00, 0xe3a147)
    static let miss = dyn(0xa3302a, 0xec7a70)
}

extension Font {
    /// Condensed heavy type for names and big numbers.
    static func display(_ size: CGFloat) -> Font { .system(size: size, weight: .heavy).width(.condensed) }
}

/// Fires on touch-down, not release: release adds 100+ ms. Every finger counts, and VoiceOver's double-tap works too.
struct TouchDownArea: UIViewRepresentable {
    let label: String
    let onDown: (TimeInterval) -> Void

    func makeUIView(context: Context) -> TouchView {
        let v = TouchView()
        v.isMultipleTouchEnabled = true
        v.backgroundColor = .clear
        v.isAccessibilityElement = true
        v.accessibilityTraits = .button
        update(v)
        return v
    }
    func updateUIView(_ v: TouchView, context: Context) { update(v) }
    private func update(_ v: TouchView) {
        v.onDown = onDown
        v.accessibilityLabel = label
    }

    final class TouchView: UIView {
        var onDown: ((TimeInterval) -> Void)?
        override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
            for t in touches { onDown?(t.timestamp) }
        }
        override func accessibilityActivate() -> Bool {
            onDown?(ProcessInfo.processInfo.systemUptime)
            return true
        }
    }
}

/// A marker button that shrinks briefly when hit.
struct MarkerButton<Content: View>: View {
    let label: String
    let action: (TimeInterval) -> Void
    @ViewBuilder let content: () -> Content
    @State private var hit = false

    var body: some View {
        content()
            .scaleEffect(hit ? 0.975 : 1)
            .brightness(hit ? 0.08 : 0)
            .overlay(TouchDownArea(label: label) { t in
                action(t)
                hit = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.09) { hit = false }
            })
            .animation(.easeOut(duration: 0.06), value: hit)
    }
}

struct Card<Content: View>: View {
    @ViewBuilder let content: () -> Content
    var body: some View {
        VStack(alignment: .leading, spacing: 12, content: content)
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.line))
    }
}

struct OutlineButtonStyle: ButtonStyle {
    var solid = false
    var color: Color = Theme.fg
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.bold))
            .padding(.horizontal, 16)
            .frame(minHeight: 44)
            .foregroundStyle(solid ? Theme.bg : color)
            .background(solid ? color : .clear, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(color, lineWidth: 2))
            .opacity(configuration.isPressed ? 0.7 : 1)
    }
}

struct Eyebrow: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text.uppercased()).font(.caption.weight(.bold)).tracking(1.2).foregroundStyle(Theme.muted)
    }
}

/// Short status messages and the white flash for deaf dogs, shown over any screen.
struct Overlays: ViewModifier {
    @EnvironmentObject var model: AppModel
    @State private var flash = false

    func body(content: Content) -> some View {
        content
            .overlay(alignment: .bottom) {
                if let t = model.toastText {
                    Text(t)
                        .font(.body.weight(.bold))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 16).padding(.vertical, 10)
                        .foregroundStyle(Theme.bg)
                        .background(Theme.fg, in: RoundedRectangle(cornerRadius: 12))
                        .padding(.horizontal, 24).padding(.bottom, 120)
                        .transition(.opacity)
                        .allowsHitTesting(false)
                }
            }
            .overlay {
                Color.white.opacity(flash ? 0.95 : 0).ignoresSafeArea().allowsHitTesting(false)
            }
            .onChange(of: model.flashTick) { _, _ in
                flash = true
                // Let the white frame render before fading it out.
                DispatchQueue.main.async { withAnimation(.easeOut(duration: 0.18)) { flash = false } }
            }
            .animation(.easeInOut(duration: 0.2), value: model.toastText)
    }
}

extension View {
    func appOverlays() -> some View { modifier(Overlays()) }
}
