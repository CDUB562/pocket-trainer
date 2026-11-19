import SwiftUI

/// Five segments, one per level; inside Learning the first segment fills by step. Sound-ladder entries fill by ladder step.
struct RingView: View {
    @EnvironmentObject var model: AppModel
    let id: String
    var size: CGFloat = 40

    private var fill: Double {
        if let snd = Catalog.sound(id) { return Double(model.sound(snd.id).level) / 2 }
        let lv = model.level(id), s = Catalog.any(id)
        let partial = lv == 0 && model.started(id) && !s.steps.isEmpty ? Double(model.prog(id).step) / Double(s.steps.count) : 0
        return Double(lv) + partial + (lv == 4 ? 1 : 0)
    }
    private var locked: Bool { Catalog.skill(id) != nil && !model.isOpen(id) }

    var body: some View {
        ZStack {
            ForEach(0..<5, id: \.self) { i in
                let a = Double(i) * 0.2 + 0.012, b = Double(i) * 0.2 + 0.188
                let part = max(0, min(1, fill - Double(i)))
                Circle().trim(from: a, to: b).stroke(Theme.line, lineWidth: 5)
                if part > 0 { Circle().trim(from: a, to: a + (b - a) * part).stroke(Theme.keep, lineWidth: 5) }
            }
            .rotationEffect(.degrees(-90))
            if locked { Image(systemName: "lock.fill").font(.system(size: size * 0.28)).foregroundStyle(Theme.muted) }
        }
        .padding(2.5)
        .frame(width: size, height: size)
        .accessibilityLabel(locked ? "Locked" : Catalog.sound(id) != nil ? "Step \(model.sound(String(id.dropFirst(4))).level) of 10" : Catalog.levels[model.level(id)])
    }
}

struct Chip: View {
    let label: String
    let on: Bool
    let action: () -> Void
    init(_ label: String, on: Bool, action: @escaping () -> Void) { self.label = label; self.on = on; self.action = action }
    var body: some View {
        Button(action: action) {
            Text(label).font(.body.weight(.bold))
                .padding(.horizontal, 14).frame(minHeight: 40)
                .foregroundStyle(on ? Theme.accentInk : Theme.fg)
                .background(on ? Theme.accent : Theme.surface, in: Capsule())
                .overlay(Capsule().stroke(on ? Theme.accent : Theme.line, lineWidth: 2))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

/// Chips in rows, wrapping to the next row when one is full.
struct Flow<Content: View>: View {
    var spacing: CGFloat = 8
    @ViewBuilder let content: () -> Content
    var body: some View { FlowLayout(spacing: spacing).callAsFunction(content) }
}

struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxW = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, rowH: CGFloat = 0, w: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x > 0 && x + s.width > maxW { x = 0; y += rowH + spacing; rowH = 0 }
            x += s.width + spacing; rowH = max(rowH, s.height); w = max(w, x - spacing)
        }
        return CGSize(width: proposal.width ?? w, height: y + rowH)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowH: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x > bounds.minX && x + s.width > bounds.maxX { x = bounds.minX; y += rowH + spacing; rowH = 0 }
            v.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(s))
            x += s.width + spacing; rowH = max(rowH, s.height)
        }
    }
}

struct SkillRef: Identifiable { let id: String }
struct VideoRef: Identifiable { let id: String }
