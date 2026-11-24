import SwiftUI

struct SkillsView: View {
    @EnvironmentObject var model: AppModel
    @State private var open: SkillRef?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("SKILLS").font(.display(28))
                HStack(alignment: .top, spacing: 10) {
                    tile("How Yes works", "When to tap it, what each sound means, and the recall whistle.", highlight: false) { model.showGuide = true }
                    tile(model.st.charged ? "Yes is charged" : "Charge Yes",
                         model.st.charged ? "Done. Repeat a round any time Yes seems to lose its meaning." : "Do this first: 2 minutes so your dog learns Yes means food.",
                         highlight: !model.st.charged) { model.route = .charge }
                }
                if model.dog == nil {
                    Text("Set up your dog on Today first.").foregroundStyle(Theme.muted)
                } else {
                    ForEach(Catalog.tracks) { t in track(t) }
                    tools
                }
            }
            .padding(16)
            .padding(.bottom, 80)
        }
        .background(Theme.bg)
        .sheet(item: $open) { ref in SkillSheet(id: ref.id).environmentObject(model) }
    }

    @ViewBuilder private func track(_ t: Track) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(t.name.uppercased()).font(.display(19)).tracking(1).foregroundStyle(Theme.muted).padding(.top, 6)
            Text(t.blurb).font(.footnote).foregroundStyle(Theme.muted)
            // Sport tracks not in this dog's goals stay folded, one tap to add.
            if let g = t.goals, !g.contains(where: model.hasGoal) {
                Button("Add to \(model.dog?.name.isEmpty == false ? model.dog!.name : "your dog")'s goals") {
                    model.updateDog { $0.goals.append(g[0]) }
                    model.st.plan = nil
                }
                .buttonStyle(OutlineButtonStyle())
            } else {
                ForEach(Catalog.skills.filter { $0.track == t.id }) { s in row(s.id, subtitle(s)) { open = SkillRef(id: s.id) } }
            }
        }
    }

    private func subtitle(_ s: Skill) -> String {
        if !model.isOpen(s.id) { return model.lockText(s.id) }
        let lv = model.level(s.id)
        if lv == 0 { return model.started(s.id) ? "Learning · step \(model.prog(s.id).step + 1) of \(s.steps.count)" : "Not started" }
        let due = model.prog(s.id).reviewDue.map { $0 <= model.today } ?? false
        return Catalog.levels[lv] + (due ? " · review due" : "")
    }

    @ViewBuilder private var tools: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("TOOLS").font(.display(19)).tracking(1).foregroundStyle(Theme.muted).padding(.top, 6)
            row("free", "Just the marker pad, no plan.", ring: false) { model.startSingle("free") }
            Text("Sound ladder: each sound at 10 volume steps, paired with food. Builds calm around noise, and is the way in to gunfire.")
                .font(.footnote).foregroundStyle(Theme.muted)
            ForEach(Catalog.sounds) { x in
                let sd = model.sound(x.id)
                row("snd:" + x.id, sd.level > 0 ? "Step \(sd.level) of 10\(model.recentStartle(x.id) ? " · startled recently" : "")" : "Not started", name: x.name) {
                    model.startSingle("snd:" + x.id)
                }
            }
        }
    }

    private func row(_ id: String, _ sub: String, name: String? = nil, ring: Bool = true, action: @escaping () -> Void) -> some View {
        let locked = Catalog.skill(id) != nil && !model.isOpen(id)
        return Button(action: action) {
            HStack(spacing: 12) {
                if ring { RingView(id: id) }
                VStack(alignment: .leading, spacing: 2) {
                    Text((name ?? Catalog.any(id).name).uppercased()).font(.display(22)).foregroundStyle(Theme.fg)
                    Text(sub).font(.footnote).foregroundStyle(Theme.muted).multilineTextAlignment(.leading)
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.line))
            .opacity(locked ? 0.62 : 1)
        }
        .buttonStyle(.plain)
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
}

/// One skill: level, what's next, the ladder, proofing and places.
struct SkillSheet: View {
    @EnvironmentObject var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let id: String
    @State private var confirmReset = false
    @State private var watching: Int?

    var body: some View {
        let s = Catalog.any(id), lv = model.level(id), open = model.isOpen(id), p = model.prog(id)
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Eyebrow(Catalog.track(s.track)?.name ?? "")
                    Spacer()
                    Button("Done") { dismiss() }.buttonStyle(OutlineButtonStyle())
                }
                HStack(spacing: 14) {
                    RingView(id: id, size: 64)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(s.name.uppercased()).font(.display(28))
                        Text(s.goal).font(.subheadline).foregroundStyle(Theme.muted)
                    }
                }
                Text((open ? Catalog.levels[lv] + ". " : "") + model.nextText(id)).font(.title3.weight(.bold))
                if open {
                    Button("Train this now") { dismiss(); DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { model.startSingle(id) } }
                        .buttonStyle(OutlineButtonStyle(solid: true))
                }
                Text("STEPS").font(.display(19)).foregroundStyle(Theme.muted)
                ForEach(Array(s.steps.enumerated()), id: \.offset) { i, step in
                    let done = lv >= 1 || i < p.step, now = i == p.step && model.started(id) && lv == 0
                    Button { watching = watching == i ? nil : i } label: {
                      HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text("\(i + 1)").font(.display(18)).foregroundStyle(done ? Theme.keep : Theme.accent).frame(width: 20, alignment: .leading)
                        Text("\(step.t): \(step.mark)").font(now ? .body.weight(.bold) : .body)
                            .foregroundStyle(done ? Theme.muted : Theme.fg).strikethrough(done).multilineTextAlignment(.leading)
                        Spacer(minLength: 8)
                        Text(watching == i ? "Close" : "Watch").font(.subheadline.weight(.bold)).foregroundStyle(Theme.toss)
                      }
                      .frame(minHeight: 44).contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    if watching == i { StepAnimation(skill: id, step: i, dog: model.dog?.name ?? "") }
                }
                if !s.dims.isEmpty {
                    Text("PROOFING").font(.display(19)).foregroundStyle(Theme.muted)
                    ForEach(s.dims, id: \.self) { d in
                        let b = model.best(id, d)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("\(["dur": "Duration", "dist": "Distance", "dis": "Distraction"][d] ?? d): \(lv >= 1 ? s.label(d, b) : "after Fluent") (goal: \(s.label(d, s.top(d))))")
                                .font(.subheadline).foregroundStyle(Theme.muted)
                            ProgressView(value: lv >= 1 ? Double(b) : 0, total: Double(max(1, s.top(d)))).tint(Theme.keep)
                        }
                    }
                }
                if lv >= 2 {
                    Text("PLACES PASSED").font(.display(19)).foregroundStyle(Theme.muted)
                    Text(p.places.isEmpty ? "None yet. Practice it somewhere new." : p.places.keys.compactMap { k in Catalog.places.first { $0.id == k }?.name }.joined(separator: ", "))
                        .foregroundStyle(Theme.muted)
                }
                if model.started(id) {
                    Button("Start this skill over") { confirmReset = true }.font(.subheadline.weight(.bold)).foregroundStyle(Theme.miss)
                }
            }
            .padding(16)
        }
        .background(Theme.bg)
        .confirmationDialog("Start \(s.name) over from step 1?", isPresented: $confirmReset, titleVisibility: .visible) {
            Button("Start over", role: .destructive) { model.resetSkill(id) }
        }
    }
}
