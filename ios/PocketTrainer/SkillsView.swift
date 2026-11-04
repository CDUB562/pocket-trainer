import SwiftUI

struct SkillsView: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("SKILLS").font(.display(28))
                HStack(alignment: .top, spacing: 10) {
                    tile("How Yes works", "When to tap it, what each sound means, and the recall whistle.", highlight: false) {
                        model.showGuide = true
                    }
                    tile(model.state.charged ? "Yes is charged" : "Charge Yes",
                         model.state.charged ? "Done. Repeat a round any time Yes seems to lose its meaning." : "Do this first: 2 minutes so your dog learns Yes means food.",
                         highlight: !model.state.charged) {
                        model.start("charge")
                    }
                }
                ForEach(Catalog.modules + [Catalog.free]) { m in row(m) }
            }
            .padding(16)
            .padding(.bottom, 80)
        }
        .background(Theme.bg)
    }

    private func tile(_ title: String, _ sub: String, highlight: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title.uppercased()).font(.display(20)).foregroundStyle(Theme.fg)
                Text(sub).font(.footnote).foregroundStyle(Theme.muted).multilineTextAlignment(.leading)
                Spacer(minLength: 0)
            }
            .padding(12)
            .frame(maxWidth: .infinity, minHeight: 120, alignment: .topLeading)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(highlight ? Theme.accent : Theme.line, lineWidth: 2))
        }
        .buttonStyle(.plain)
    }

    private func row(_ m: Module) -> some View {
        let p = model.prog(m.id)
        return Button { model.start(m.id) } label: {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(m.name.uppercased()).font(.display(22)).foregroundStyle(Theme.fg)
                    Text(m.goal).font(.footnote).foregroundStyle(Theme.muted).multilineTextAlignment(.leading)
                }
                Spacer()
                if !m.steps.isEmpty {
                    VStack(alignment: .trailing, spacing: 4) {
                        Text(p.done ? "Done" : "Step \(p.step + 1) of \(m.steps.count)")
                            .font(.caption.weight(p.done ? .bold : .regular)).monospacedDigit()
                            .foregroundStyle(p.done ? Theme.keep : Theme.muted)
                        ProgressView(value: Double(p.done ? m.steps.count : p.step), total: Double(m.steps.count))
                            .tint(Theme.keep).frame(width: 64)
                    }
                }
            }
            .padding(.horizontal, 14).padding(.vertical, 12)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.line))
        }
        .buttonStyle(.plain)
    }
}
