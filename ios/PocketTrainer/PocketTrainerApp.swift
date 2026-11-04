import SwiftUI

@main
struct PocketTrainerApp: App {
    @StateObject private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
                .environmentObject(model.recorder)
        }
    }
}

struct RootView: View {
    @EnvironmentObject var model: AppModel
    @Environment(\.scenePhase) private var phase
    @State private var tab = "today"

    var body: some View {
        TabView(selection: $tab) {
            TodayView(tab: $tab)
                .tabItem { Label("Today", systemImage: "sun.max.fill") }.tag("today")
            SkillsView()
                .tabItem { Label("Skills", systemImage: "list.bullet") }.tag("skills")
            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape.fill") }.tag("setup")
        }
        .tint(Theme.accent)
        .overlay(alignment: .bottomTrailing) {
            // The recall whistle is one press away on every screen.
            MarkerButton(label: "Play the recall whistle", action: { _ in model.recall() }) {
                Text("RECALL")
                    .font(.display(20)).tracking(1)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 20).padding(.vertical, 14)
                    .background(Theme.toss, in: Capsule())
                    .shadow(color: .black.opacity(0.25), radius: 9, y: 6)
            }
            .padding(.trailing, 16).padding(.bottom, 64)
        }
        .appOverlays()
        .fullScreenCover(item: $model.route) { route in
            Group {
                switch route {
                case .training(let id): TrainingView(module: Catalog.module(id))
                case .charge: ChargeView()
                }
            }
            .environmentObject(model)
            .environmentObject(model.recorder)
        }
        .sheet(isPresented: $model.showGuide, onDismiss: { model.state.guideSeen = true }) {
            GuideView()
        }
        .onChange(of: phase) { _, p in
            if p == .active { model.becameActive() }
        }
        #if DEBUG
        .onAppear {
            let args = ProcessInfo.processInfo.arguments
            if let i = args.firstIndex(of: "-tab"), i + 1 < args.count { tab = args[i + 1] }
            if args.contains("-openTraining") { model.start("sit") }
        }
        #endif
    }
}
