import SwiftUI

struct GuideView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text("HOW YES WORKS").font(.display(30))
                    Spacer()
                    Button("Done") { dismiss() }.buttonStyle(OutlineButtonStyle())
                }
                Text("Yes is a camera shutter. It tells your dog the exact moment they earned the treat, so they can repeat that moment. The treat comes a second later; the sound is the part they learn from.")
                heading("The rules")
                numbered(1, "Charge it first.", "Before Yes means anything, it has to mean food. Do the 2-minute Charge routine once or twice, then start training.")
                numbered(2, "Tap the instant it happens.", "Mark when the rear touches the floor, not when the dog is already getting up again. Every step tells you exactly what to mark.")
                numbered(3, "Every Yes gets a treat.", "Even an accidental one. A Yes without food teaches your dog to ignore it.")
                numbered(4, "Hands still, then treat.", "Tap first, then reach for the treat. If your hand moves first, your dog watches your hand instead of listening.")
                numbered(5, "Yes ends the rep.", "After Yes your dog may move to get the treat. That's fine. Set up the next rep, or tap Free to finish.")
                numbered(6, "No Yes for nothing.", "Don't use it to call your dog, to get attention, or as praise. Praise all you want, but with your voice.")
                numbered(7, "Missed it? Tap Miss.", "No sound, no treat, no scolding. Just reset and try again. Two misses in a row means the step is too hard: make it easier.")
                heading("When to use Yes")
                Text("Use it while you're teaching or polishing a skill. Once a step is solid (4 of 5 right on at least two different days, in more than one place), you can reward with praise, play, or a door opening instead, and save Yes for new steps. Whenever you do use Yes, food follows.")
                heading("The four sounds")
                sound("Yes", Theme.accent, "That was it. Come get your treat from my hand.")
                sound("Catch", Theme.toss, "That was it, and the treat is flying. Toss it so your dog moves away and resets for the next rep.")
                sound("Keep going", Theme.keep, "You're on the right track, keep doing it. No treat. It only shows on holds and walking steps.")
                sound("Free", Theme.fg, "You're released. The session is over, go sniff.")
                heading("The recall whistle")
                numbered(1, "Any screen", "The blue Recall button plays it from any screen. Use it only to call your dog, never to scold or interrupt.", color: Theme.toss)
                numbered(2, "Jackpot", "Every time it plays, pay a jackpot: 5 or more treats in a row, or the best toy.", color: Theme.toss)
                numbered(3, "Charge it at home", "Play it, then jackpot, ten times over a few days, before you ever need it outside.", color: Theme.toss)
                heading("Filming a session")
                Text("Tap Record on the training screen. Hold the phone at your chest with the screen facing you; the back camera sees your dog. Afterwards, Review shows every tap on the video so you can see whether you marked the right moment.")
                Button("Got it") { dismiss() }.buttonStyle(OutlineButtonStyle(solid: true))
            }
            .padding(16)
        }
        .background(Theme.bg)
    }

    private func heading(_ t: String) -> some View {
        Text(t.uppercased()).font(.display(19)).tracking(1).foregroundStyle(Theme.muted).padding(.top, 4)
    }

    private func sound(_ name: String, _ color: Color, _ text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text(name.uppercased()).font(.display(20)).foregroundStyle(color).frame(width: 110, alignment: .leading)
            Text(text).fixedSize(horizontal: false, vertical: true)
        }
    }
}
