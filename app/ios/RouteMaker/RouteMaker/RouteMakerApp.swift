import Lynx
import SwiftUI
import XElement

@main
struct RouteMakerApp: App {
    init() {
        RouteMakerSessionStore.discardIfReinstalled()

        // The bundle is passed to the view as bytes, so there is no template provider.
        let config = LynxConfig(provider: nil)
        config.register(RouteMakerSessionModule.self)
        config.register(RouteMakerShareModule.self)
        config.register(RouteMakerAppearanceModule.self)
        config.register(RouteMakerNavigationModule.self)
        config.register(RouteMakerMapModule.self)

        // XElement provides <input> and <svg>; each is registered by hand. <input> also
        // needs its shadow node to be measured.
        config.registerUI(LynxUIInput.self, withName: "input")
        config.registerShadowNode(LynxUIInputShadowNode.self, withName: "input")
        config.registerUI(LynxUISVG.self, withName: "svg")
        LynxEnv.sharedInstance().prepareConfig(config)
    }

    var body: some Scene {
        WindowGroup {
            RouteMakerHostView()
        }
    }
}

/// The controller insets Lynx for the safe area and the keyboard and paints the bands around it,
/// so the window is full screen.
struct RouteMakerHostView: View {
    @Environment(\.colorScheme) private var colorScheme
    @AppStorage(RouteMakerAppearance.key) private var preference: String?

    var body: some View {
        RouteMakerLynxHost(systemTheme: colorScheme == .dark ? "dark" : "light")
            .ignoresSafeArea()
            // With a saved preference the environment already reports it, and JS prefers
            // it over the system theme anyway.
            .preferredColorScheme(preference.map { $0 == "dark" ? .dark : .light })
    }
}

private struct RouteMakerLynxHost: UIViewControllerRepresentable {
    let systemTheme: String

    func makeUIViewController(context: Context) -> RouteMakerLynxViewController {
        RouteMakerLynxViewController(systemTheme: systemTheme)
    }

    func updateUIViewController(_ viewController: RouteMakerLynxViewController, context: Context) {
        viewController.updateSystemTheme(systemTheme)
    }
}
