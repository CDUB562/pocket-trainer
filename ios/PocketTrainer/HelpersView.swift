import SwiftUI

/// A note the owner reads and confirms before a track opens.
struct GateCard: View {
    let gate: Gate
    let confirm: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(gate.title).font(.headline)
            Text(gate.text).font(.subheadline)
            Button(gate.confirm, action: confirm).buttonStyle(OutlineButtonStyle(solid: true))
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.warn, lineWidth: 2))
    }
}

/// Canine Good Citizen: each test item is ready when its skills are Fluent.
struct CGCCard: View {
    @EnvironmentObject var model: AppModel
    @State private var expanded = false
    let openSkill: (String) -> Void

    private func ready(_ c: CGCItem) -> Bool { c.needs.allSatisfy { model.level($0) >= 1 } }

    var body: some View {
        let items = Catalog.data.cgc, n = items.filter(ready).count
        DisclosureGroup(isExpanded: $expanded) {
            VStack(alignment: .leading, spacing: 10) {
                ForEach(Array(items.enumerated()), id: \.offset) { i, c in
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(i + 1). \(c.t)").font(.subheadline.weight(.bold)).foregroundStyle(ready(c) ? Theme.keep : Theme.fg)
                        Flow { ForEach(c.needs, id: \.self) { id in Chip(Catalog.any(id).name + (model.level(id) >= 1 ? " \u{2713}" : ""), on: false) { openSkill(id) } } }
                    }
                }
                Text("Ready means every linked skill is Fluent. A certified evaluator gives the real test.").font(.footnote).foregroundStyle(Theme.muted)
            }
            .padding(.top, 8)
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(n == items.count ? "Test ready" : "Canine Good Citizen test").font(.headline).foregroundStyle(Theme.fg)
                    Spacer()
                    Text("\(n) of \(items.count) ready").font(.subheadline).monospacedDigit().foregroundStyle(Theme.muted)
                }
                ProgressView(value: Double(n), total: Double(items.count)).tint(Theme.keep)
            }
        }
        .padding(14)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.line))
    }
}

/// One behavior helper: what stops the plan, the steps, the skills that build it, and a daily log.
struct HelperSheet: View {
    @EnvironmentObject var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let helper: Helper
    let openSkill: (String) -> Void
    @State private var watching: Int?
    @State private var measure = ""

    private var state: HelpState { model.st.help[helper.id] ?? HelpState() }
    private func update(_ change: (inout HelpState) -> Void) { var s = state; change(&s); model.st.help[helper.id] = s }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack { Eyebrow("Behavior helper"); Spacer(); Button("Done") { dismiss() }.buttonStyle(OutlineButtonStyle()) }
                Text(helper.name.uppercased()).font(.display(28))
                Text(helper.goal).font(.subheadline).foregroundStyle(Theme.muted)
                if state.stopped != nil { paused } else { plan }
            }
            .padding(16)
        }
        .background(Theme.bg)
        .appOverlays()
    }

    private var paused: some View {
        warning("This plan is paused", "What you saw needs a person, not an app. See your vet first, because pain and illness change behavior, then a certified behavior consultant or veterinary behaviorist. Until then keep everyone safe: distance, gates, a leash, and nothing that sets it off.",
                "A professional says we can continue") { update { $0 = HelpState() } }
    }

    @ViewBuilder private var plan: some View {
        warning("Stop and get help if you see", "A bite, a sudden change in behavior, or panic. Also: \(helper.stop.prefix(1).lowercased() + helper.stop.dropFirst()).", "I've seen this") { update { $0.stopped = model.today } }
        ForEach(Array(helper.steps.enumerated()), id: \.offset) { i, step in
            Button { watching = watching == i ? nil : i } label: {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text("\(i + 1)").font(.display(18)).foregroundStyle(Theme.accent).frame(width: 20, alignment: .leading)
                    Text("\(step.t): \(step.do)").foregroundStyle(Theme.fg).multilineTextAlignment(.leading)
                    Spacer(minLength: 8)
                    Text(watching == i ? "Close" : "Watch").font(.subheadline.weight(.bold)).foregroundStyle(Theme.toss)
                }
                .frame(minHeight: 44).contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            if watching == i { StepAnimation(skill: "help:" + helper.id, step: i, dog: model.dog?.name ?? "") }
        }
        Text("Skills that build this").font(.subheadline).foregroundStyle(Theme.muted)
        Flow { ForEach(helper.uses, id: \.self) { id in Chip(Catalog.any(id).name, on: false) { openSkill(id) } } }
        Text("HOW DID TODAY GO?").font(.display(19)).foregroundStyle(Theme.muted)
        if let m = helper.measure {
            TextField("\(m.label) (\(m.unit))", text: $measure).keyboardType(.decimalPad).textFieldStyle(.roundedBorder)
        }
        HStack {
            ForEach(["better", "same", "worse"], id: \.self) { r in
                Button(r.capitalized) { log(r) }
                    .buttonStyle(OutlineButtonStyle(solid: state.log.last.map { $0.day == model.today && $0.r == r } ?? false))
                    .frame(maxWidth: .infinity)
            }
        }
        if !state.log.isEmpty {
            Text(state.log.suffix(5).reversed().map { x in
                "\(x.day.dropFirst(5)): \(x.r)" + (x.m.map { " (\($0.formatted()) \(helper.measure?.unit ?? ""))" } ?? "")
            }.joined(separator: " \u{00B7} ")).font(.footnote).foregroundStyle(Theme.muted)
        }
    }

    private func log(_ r: String) {
        let m = Double(measure.replacingOccurrences(of: ",", with: "."))
        update { s in
            s.log.removeAll { $0.day == model.today }
            s.log.append(HelpLog(day: model.today, r: r, m: m))
            s.log = Array(s.log.suffix(60))
        }
        let last = state.log.suffix(3)
        model.toast(last.count == 3 && last.allSatisfy { $0.r == "worse" } ? "Worse three times running. Go back to the easiest step, and talk to a certified trainer."
                    : r == "worse" ? "Go back to the easier step tomorrow." : "Logged.")
    }

    private func warning(_ title: String, _ text: String, _ button: String, _ action: @escaping () -> Void) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.headline)
            Text(text).font(.subheadline)
            Button(button, action: action).buttonStyle(OutlineButtonStyle())
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.warn, lineWidth: 2))
    }
}
