import SwiftUI

struct TodayView: View {
    @EnvironmentObject var model: AppModel
    @EnvironmentObject var recorder: Recorder
    @Binding var tab: String
    @State private var dogName = ""
    @State private var reviewing: VideoRef?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .firstTextBaseline) {
                    let dog = model.state.settings.dog.trimmingCharacters(in: .whitespaces)
                    Text(dog.isEmpty ? "TODAY" : "TODAY WITH \(dog.uppercased())").font(.display(28))
                    Spacer()
                    Text(Date(), format: .dateTime.weekday(.abbreviated).month(.abbreviated).day())
                        .font(.subheadline).foregroundStyle(Theme.muted)
                }

                if model.state.settings.dog.isEmpty && !model.state.dogAsked {
                    Card {
                        Text("What's your dog's name?").font(.headline)
                        HStack {
                            TextField("Milo", text: $dogName)
                                .textFieldStyle(.roundedBorder)
                                .submitLabel(.done)
                                .onSubmit(saveDog)
                            Button("Save", action: saveDog).buttonStyle(OutlineButtonStyle(solid: true))
                        }
                    }
                }

                if let s = model.state.last { lastCard(s) }

                let plan = model.state.plan ?? DayPlan(day: "", items: [], done: [])
                let next = plan.items.first { !plan.done.contains($0) }
                if let next {
                    nextCard(next, index: plan.done.count + 1, of: plan.items.count)
                } else {
                    Text(plan.items.isEmpty
                         ? "Every skill is done. Keep them sharp: pick one under Train something else and practice it somewhere new."
                         : "All of today's sessions are done. Extra practice is fine, but stopping while your dog still wants more is better.")
                        .font(.subheadline).foregroundStyle(Theme.muted)
                }
                ForEach(plan.items.filter { $0 != next }, id: \.self) { id in
                    laterRow(id, done: plan.done.contains(id))
                }

                Button("Train something else") { tab = "skills" }
                    .font(.subheadline.weight(.bold)).foregroundStyle(Theme.toss)
                    .padding(.vertical, 6)
            }
            .padding(16)
            .padding(.bottom, 80)
        }
        .background(Theme.bg)
        .onAppear { model.refreshPlan() }
        .sheet(item: $reviewing) { ref in ReviewView(name: ref.id) }
    }

    private func saveDog() {
        model.state.settings.dog = dogName.trimmingCharacters(in: .whitespaces)
        model.state.dogAsked = true
    }

    private func nextCard(_ id: String, index: Int, of total: Int) -> some View {
        let d = model.describe(id)
        return Button { model.start(id) } label: {
            VStack(alignment: .leading, spacing: 4) {
                Text("NEXT UP · ABOUT 2 MINUTES · \(index) OF \(total)").font(.caption.weight(.bold)).tracking(1.2).opacity(0.85)
                Text(d.name.uppercased()).font(.display(42)).lineLimit(2).minimumScaleFactor(0.6)
                Text(d.sub).font(.body.weight(.bold))
                Text(d.mark).font(.subheadline).opacity(0.9)
                Text("START")
                    .font(.display(24)).tracking(1)
                    .frame(maxWidth: .infinity).padding(12)
                    .foregroundStyle(Theme.accent)
                    .background(Theme.accentInk, in: RoundedRectangle(cornerRadius: 12))
                    .padding(.top, 10)
            }
            .multilineTextAlignment(.leading)
            .foregroundStyle(Theme.accentInk)
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.accent, in: RoundedRectangle(cornerRadius: 20))
        }
        .buttonStyle(.plain)
    }

    private func laterRow(_ id: String, done: Bool) -> some View {
        let d = model.describe(id)
        return Button { model.start(id) } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(d.name.uppercased()).font(.display(20))
                        .strikethrough(done).foregroundStyle(done ? Theme.muted : Theme.fg)
                    Text(done ? "Done today" : d.sub).font(.footnote).foregroundStyle(Theme.muted)
                }
                Spacer()
                if done { Image(systemName: "checkmark").font(.body.weight(.bold)).foregroundStyle(Theme.keep) }
            }
            .padding(.horizontal, 14).padding(.vertical, 12)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.line))
        }
        .buttonStyle(.plain)
    }

    private func lastCard(_ s: Summary) -> some View {
        let slow = (s.rate ?? 99) < 8
        var notes = [s.round, s.treats].filter { !$0.isEmpty }
        if slow { notes.append("Under 8 rewards a minute: make the next session easier so your dog wins more often") }
        // Re-checked whenever the recorder finishes a file (savedCount changes).
        let videoReady = recorder.savedCount >= 0 && (s.video.map(Recorder.isReady) ?? false)
        return Card {
            HStack {
                Eyebrow("Last session · \(s.title)")
                Spacer()
                Button("Dismiss") { model.state.last = nil }.font(.subheadline.weight(.bold)).foregroundStyle(Theme.toss)
            }
            HStack(alignment: .top) {
                fig(clock(s.secs), "Time")
                fig("\(s.marks)", "Marks")
                fig(s.rate.map(String.init) ?? "–", "Per minute", warn: slow)
            }
            Text(notes.joined(separator: ". ") + ".").font(.subheadline).foregroundStyle(Theme.muted)
            if videoReady, let v = s.video {
                Button("Review the video") { reviewing = VideoRef(id: v) }.buttonStyle(OutlineButtonStyle())
            }
        }
    }

    private func fig(_ value: String, _ label: String, warn: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value).font(.display(30)).monospacedDigit().foregroundStyle(warn ? Theme.warn : Theme.fg)
            Eyebrow(label)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct VideoRef: Identifiable {
    let id: String
}
