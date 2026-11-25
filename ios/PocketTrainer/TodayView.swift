import SwiftUI

struct TodayView: View {
    @EnvironmentObject var model: AppModel
    @EnvironmentObject var recorder: Recorder
    @Binding var tab: String
    @State private var reviewing: VideoRef?
    @State private var passport = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                header
                if let dog = model.dog {
                    if model.root.dogs.count > 1 {
                        Flow { ForEach(model.root.dogs) { d in Chip(d.name.isEmpty ? "Unnamed" : d.name, on: d.id == dog.id) { model.switchDog(d.id) } } }
                    }
                    if dog.legacy || dog.birth == nil {
                        Card {
                            Text("Finish \(dog.name.isEmpty ? "your dog" : dog.name)'s profile").font(.headline)
                            Text("Six quick answers (about a minute) so the plan fits their age, breed and goals.").font(.subheadline).foregroundStyle(Theme.muted)
                            Button("Set up") { model.showOnboarding = dog }.buttonStyle(OutlineButtonStyle(solid: true))
                        }
                    }
                    if model.hardWeek {
                        Text("\(model.dogName.capitalizedFirst) is having a hard week, which is normal (especially for teenagers). Easier plan until reviews pass again.")
                            .font(.subheadline).foregroundStyle(Theme.muted)
                    }
                    Eyebrow("Where are you training?")
                    Flow {
                        ForEach(Catalog.places) { p in Chip(p.name, on: model.st.place == p.id) { model.st.place = p.id; model.refreshPlan() } }
                    }
                    conditions
                    planCard
                    seasons
                    puppy
                    week
                    if let s = model.st.last { lastCard(s) }
                    Button("Train something else") { tab = "skills" }
                        .font(.subheadline.weight(.bold)).foregroundStyle(Theme.toss).padding(.vertical, 6)
                } else {
                    Card {
                        Text("Set up your dog").font(.headline)
                        Text("Six quick answers so the plan fits their age, breed and goals.").font(.subheadline).foregroundStyle(Theme.muted)
                        Button("Set up") { model.showOnboarding = Dog() }.buttonStyle(OutlineButtonStyle(solid: true))
                    }
                }
            }
            .padding(16)
            .padding(.bottom, 80)
        }
        .background(Theme.bg)
        .onAppear { model.refreshPlan() }
        .sheet(item: $reviewing) { ref in ReviewView(name: ref.id) }
        .sheet(isPresented: $passport) { PassportView().environmentObject(model) }
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            let name = model.dog?.name ?? ""
            Text(name.isEmpty ? "TODAY" : "TODAY WITH \(name.uppercased())").font(.display(28)).lineLimit(1).minimumScaleFactor(0.6)
            Spacer()
            Text(Date(), format: .dateTime.weekday(.abbreviated).month(.abbreviated).day()).font(.subheadline).foregroundStyle(Theme.muted)
        }
    }

    // Heat: a hot-day switch for outdoor places. Flat-faced breeds get the warning whenever they're outside.
    @ViewBuilder private var conditions: some View {
        let outdoor = model.st.place != "home", hot = model.st.hot == model.today
        if outdoor {
            Flow { Chip("Hot day", on: hot) { model.st.hot = hot ? "" : model.today; model.st.plan = nil; model.refreshPlan() } }
            if hot || model.dog?.flat == true {
                Text(hot ? "Hot day: shorter field work, longer breaks in shade, water every break. Stop at heavy panting or a wide, flat tongue."
                         : "\(model.dog?.breed ?? "Flat-faced dogs") overheat fast: keep outdoor blocks to 5 minutes with water and shade between.")
                    .font(.subheadline.weight(.bold)).foregroundStyle(Theme.warn)
            }
        }
    }

    @ViewBuilder private var planCard: some View {
        let p = model.plan
        if p.blocks.isEmpty {
            Card { Text("Nothing to train here right now.").font(.headline); Text("Try another place, or pick any skill under Train something else.").foregroundStyle(Theme.muted) }
        } else if p.done {
            Card {
                Text("Today's session is done.").font(.headline)
                Text("Rest helps it stick. Another short session later is fine if your dog is keen.").font(.subheadline).foregroundStyle(Theme.muted)
                Button("Another short session") { model.refreshPlan(force: true, short: true, avoid: p.blocks.map(\.id)) }.buttonStyle(OutlineButtonStyle())
            }
        } else {
            VStack(alignment: .leading, spacing: 10) {
                let mins = model.planMinutes(p)
                Text((p.field ? "Field day · about \(mins) minutes with breaks" : p.rest ? "Rest day · optional review · about \(mins) min"
                      : p.offDay ? "Not a planned day · optional · about \(mins) min" : "Next session · about \(mins) minutes").uppercased())
                    .font(.caption.weight(.bold)).tracking(1.2).opacity(0.85)
                ForEach(Array(p.blocks.enumerated()), id: \.offset) { _, b in
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text((b.kind == "charge" ? "First" : AppModel.roleNames[b.role] ?? "Skill").uppercased())
                            .font(.caption2.weight(.bold)).tracking(1).opacity(0.8).frame(width: 64, alignment: .leading)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(Catalog.any(b.id).name.uppercased()).font(.display(22))
                            Text(model.blockLine(b)).font(.subheadline).opacity(0.9)
                        }
                    }
                }
                let gear = model.planGear(p)
                if !gear.isEmpty { Text("Bring: " + gear.joined(separator: ", ") + ".").font(.footnote).opacity(0.9) }
                Button { model.startPlan() } label: {
                    Text("START").font(.display(24)).tracking(1).frame(maxWidth: .infinity).padding(12)
                        .foregroundStyle(Theme.accent).background(Theme.accentInk, in: RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(.plain)
                if p.blocks.first?.kind != "charge" {
                    HStack(spacing: 18) {
                        Button("Shorter") { model.refreshPlan(force: true, short: true) }
                        Button("Something different") { model.refreshPlan(force: true, avoid: p.blocks.map(\.id)) }
                        // Out at the field or water on another day: offer the longer field session anyway.
                        if !p.field && model.fieldGoal && ["field", "water", "park"].contains(model.st.place) {
                            Button("Field session") { model.refreshPlan(force: true, field: true) }
                        }
                    }
                    .font(.subheadline.weight(.bold)).underline()
                }
            }
            .multilineTextAlignment(.leading)
            .foregroundStyle(Theme.accentInk)
            .tint(Theme.accentInk)
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.accent, in: RoundedRectangle(cornerRadius: 20))
        }
    }

    @ViewBuilder private var seasons: some View {
        ForEach(Catalog.tracks.filter { $0.gate != nil && ($0.goals ?? []).contains(where: model.hasGoal) }) { t in
            if let g = model.gate(t) { GateCard(gate: g) { model.confirmGate(t) } }
        }
        ForEach(Catalog.data.seasons.keys.sorted(), id: \.self) { g in
            if let i = model.seasonInfo(g), i.days >= -60 {
                Card {
                    HStack {
                        Text("\(i.name) \(i.days > 0 ? "in \(i.days) day\(i.days == 1 ? "" : "s")" : i.days == 0 ? "today" : "under way")").font(.headline)
                        Spacer()
                        Text("\(i.pct)% ready").font(.subheadline).monospacedDigit().foregroundStyle(Theme.muted)
                    }
                    ProgressView(value: Double(i.pct), total: 100).tint(Theme.keep)
                    if i.left.isEmpty {
                        Text("Every milestone is Fluent. Keep them sharp with short reviews.").font(.subheadline).foregroundStyle(Theme.muted)
                    } else {
                        let next = i.left.prefix(3).map { Catalog.any($0).name + (model.isOpen($0) ? "" : " (locked)") }.joined(separator: ", ")
                        Text("Still to go: \(next)\(i.left.count > 3 ? " and \(i.left.count - 3) more" : "").").font(.subheadline).foregroundStyle(Theme.muted)
                        if i.behind && i.days > 0 {
                            Text("Behind pace for \(i.left.count) milestones in \(i.days) days. Add a field day, and the plan already puts these first.")
                                .font(.subheadline.weight(.bold)).foregroundStyle(Theme.warn)
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder private var puppy: some View {
        if model.showPassport {
            Card {
                HStack { Text("Socialization passport").font(.headline); Spacer(); Text("\(model.passportCount) of \(model.passportTotal)").monospacedDigit().foregroundStyle(Theme.muted) }
                let newToday = model.st.passport.values.filter { $0.day == model.today }.count
                Text((model.ageWeeks ?? 99) < 16 ? "The best window for this closes around 16 weeks. Aim for 3 new good experiences a day (\(newToday) today)."
                     : "Keep adding good experiences, about 3 a day (\(newToday) today).").font(.subheadline).foregroundStyle(Theme.muted)
                Button("Open the passport") { passport = true }.buttonStyle(OutlineButtonStyle())
            }
        }
        if model.pottyOn {
            Card {
                HStack { Text("Potty plan").font(.headline); Spacer(); Button("Turn off") { model.st.potty.on = false }.font(.subheadline.weight(.bold)).foregroundStyle(Theme.toss) }
                Text(model.pottyText).font(.subheadline)
                HStack {
                    Button("Went outside") { model.potty(true) }.buttonStyle(OutlineButtonStyle(solid: true))
                    Button("Accident inside") { model.potty(false) }.buttonStyle(OutlineButtonStyle())
                }
            }
        }
    }

    private var week: some View {
        let cal = Calendar.current, dow = (cal.component(.weekday, from: Date()) + 5) % 7 // Monday first
        let monday = model.addDays(model.today, -dow), names = ["M", "T", "W", "T", "F", "S", "S"]
        let days = (0..<7).map { model.addDays(monday, $0) }
        let done = days.filter { model.st.days.contains($0) }.count
        return HStack(spacing: 6) {
            ForEach(0..<7, id: \.self) { i in
                let day = days[i], planned = model.dog?.days.contains((i + 1) % 7) ?? false, did = model.st.days.contains(day)
                Text(names[i]).font(.caption2.weight(.bold))
                    .frame(maxWidth: .infinity, minHeight: 28)
                    .foregroundStyle(did ? Theme.surface : Theme.muted)
                    .background(did ? Theme.keep : .clear, in: RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(did ? Theme.keep : Theme.line, style: StrokeStyle(lineWidth: 2, dash: planned || did ? [] : [3, 3])))
                    .overlay(RoundedRectangle(cornerRadius: 9).stroke(day == model.today ? Theme.fg : .clear, lineWidth: 2).padding(-2))
            }
            Text("\(done) of \(model.dog?.days.count ?? 7) days").font(.footnote).monospacedDigit().foregroundStyle(Theme.muted).fixedSize()
        }
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
                Button("Dismiss") { model.st.last = nil }.font(.subheadline.weight(.bold)).foregroundStyle(Theme.toss)
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

struct PassportView: View {
    @EnvironmentObject var model: AppModel
    @Environment(\.dismiss) private var dismiss
    private let words = ["happy": "Happy", "unsure": "Unsure: repeat easier", "scared": "Scared: go much easier"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack { Text("PASSPORT").font(.display(30)); Spacer(); Button("Done") { dismiss() }.buttonStyle(OutlineButtonStyle()) }
                Text("Each new thing should be a good experience: keep your distance, pair it with food, and leave before your puppy worries. Tap an item to log how it went.")
                    .font(.subheadline).foregroundStyle(Theme.muted)
                ForEach(Catalog.data.passport) { g in
                    let n = g.items.filter { model.st.passport["\(g.id):\($0)"]?.r == "happy" }.count
                    Text("\(g.name) · \(n) of \(g.items.count)".uppercased()).font(.display(19)).foregroundStyle(Theme.muted)
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 8)], spacing: 8) {
                        ForEach(g.items, id: \.self) { item in
                            let key = "\(g.id):\(item)", r = model.st.passport[key]?.r
                            let color = r == "happy" ? Theme.keep : r == "unsure" ? Theme.warn : r == "scared" ? Theme.miss : Theme.line
                            Button { model.cyclePassport(key) } label: {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(item).font(.subheadline).foregroundStyle(Theme.fg).multilineTextAlignment(.leading)
                                    Text((r.flatMap { words[$0] } ?? "Not yet").uppercased()).font(.caption2.weight(.bold)).foregroundStyle(r == nil ? Theme.muted : color)
                                }
                                .padding(10).frame(maxWidth: .infinity, minHeight: 56, alignment: .leading)
                                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
                                .overlay(RoundedRectangle(cornerRadius: 12).stroke(color, lineWidth: 2))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .padding(16)
        }
        .background(Theme.bg)
    }
}

extension String {
    var capitalizedFirst: String { prefix(1).uppercased() + dropFirst() }
}
