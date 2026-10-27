import Foundation
import Lynx

enum RouteMakerAppearance {
    static let key = "routemaker.theme"

    /// The saved "light" or "dark", or nil when the system's theme applies.
    static var preference: String? {
        UserDefaults.standard.string(forKey: key)
    }

    /// Saves "light" or "dark"; "system" forgets the choice so the system's theme applies.
    static func save(_ preference: String) {
        // RouteMakerApp's @AppStorage observes this key; systemTheme then reports the effective theme.
        if preference == "system" {
            UserDefaults.standard.removeObject(forKey: key)
        } else {
            UserDefaults.standard.set(preference, forKey: key)
        }
    }
}

@objcMembers
final class RouteMakerAppearanceModule: RouteMakerModule, LynxModule {
    static var name: String { "RouteMakerAppearance" }

    static var methodLookup: [String: String] {
        ["setPreference": NSStringFromSelector(#selector(setPreference(_:)))]
    }

    func setPreference(_ preference: String) {
        RouteMakerAppearance.save(preference)
    }
}
