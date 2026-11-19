import SwiftUI
import UIKit

/// Teaches the dog that Yes means food: the app plays Yes at random moments and the owner hands over one treat each time.
struct ChargeView: View {
    @EnvironmentObject var model: AppModel
    @State private var done = 0
    @State private var running = false
    @State private var big = "Ready"
    @State private var sub = "Have 20 small treats in hand."
    @State private var treat = false
    @State private var task: Task<Void, Never>?
    private let reps = 20

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Button { stop(); model.route = nil } label: {
                    Image(systemName: "chevron.left").font(.title3.weight(.bold))
                        .frame(width: 44, height: 44)
                        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.line, lineWidth: 2))
                }
                .foregroundStyle(Theme.fg)
                .accessibilityLabel("Back")
                VStack(alignment: .leading, spacing: 0) {
                    Text("CHARGE YES").font(.display(24))
                    Text("20 treats, about 2 minutes").font(.caption).foregroundStyle(Theme.muted)
                }
            }
            Text("Teaches your dog that the Yes sound means food. The app plays Yes at random moments; you hand over one treat each time. Your dog does not need to do anything.")
                .font(.subheadline).foregroundStyle(Theme.muted)
            VStack(spacing: 8) {
                Text(big.uppercased()).font(.display(76)).minimumScaleFactor(0.5)
                Text(sub).font(.body).multilineTextAlignment(.center)
            }
            .foregroundStyle(treat ? Theme.accentInk : Theme.fg)
            .padding(16)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(treat ? Theme.accent : Theme.surface, in: RoundedRectangle(cornerRadius: 22))
            .overlay(RoundedRectangle(cornerRadius: 22).stroke(treat ? Theme.accent : Theme.line, lineWidth: 2))
            HStack(spacing: 6) {
                ForEach(0..<reps, id: \.self) { i in
                    Capsule().fill(i < done ? Theme.accent : Theme.line).frame(height: 10)
                }
            }
            .accessibilityElement().accessibilityLabel("\(done) of \(reps) done")
            HStack {
                Button(running ? "Pause" : done > 0 && done < reps ? "Resume" : "Start") { toggle() }
                    .buttonStyle(OutlineButtonStyle(solid: true))
                Button("Reset") { stop(); done = 0; show("Ready", "Have 20 small treats in hand.", false) }
                    .buttonStyle(OutlineButtonStyle())
            }
        }
        .padding(16)
        .background(Theme.bg)
        .appOverlays()
        .onAppear { UIApplication.shared.isIdleTimerDisabled = true; model.audio.ensureRunning() }
        .onDisappear { stop(); UIApplication.shared.isIdleTimerDisabled = false }
    }

    private func show(_ b: String, _ s: String, _ t: Bool) { big = b; sub = s; treat = t }

    private func stop() {
        running = false
        task?.cancel()
        task = nil
    }

    private func toggle() {
        if running { stop(); show("Paused", "\(done) of \(reps) done.", false); return }
        if done >= reps { done = 0 }
        running = true
        task = Task { @MainActor in
            while !Task.isCancelled && done < reps {
                show("Wait", "Hands still. Don't reach for a treat yet.", false)
                try? await Task.sleep(nanoseconds: UInt64(Double.random(in: 2.0...5.5) * 1_000_000_000))
                if Task.isCancelled { return }
                model.audio.play(.yes)
                model.feedback()
                done += 1
                show("Treat", "Rep \(done) of \(reps). Hand it over now.", true)
                try? await Task.sleep(nanoseconds: 1_800_000_000)
            }
            if Task.isCancelled { return }
            running = false
            model.st.charged = true
            if !model.st.days.contains(model.today) { model.st.days.append(model.today) }
            model.st.plan = nil
            show("Charged", "Do one more round tomorrow. Your first skills are on Today now.", false)
        }
    }
}
