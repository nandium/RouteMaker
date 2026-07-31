import Foundation
import Lynx
import UIKit

enum RouteMakerAppearance {
    private static let key = "routemaker.theme"

    static var preference: String? {
        UserDefaults.standard.string(forKey: key)
    }

    static func save(_ preference: String) {
        UserDefaults.standard.set(preference, forKey: key)
    }
}

@objcMembers
final class RouteMakerAppearanceModule: NSObject, LynxModule {
    static var name: String { "RouteMakerAppearance" }

    static var methodLookup: [String: String] {
        ["setPreference": NSStringFromSelector(#selector(setPreference(_:)))]
    }

    init(param: Any) {
        super.init()
    }

    override init() {
        super.init()
    }

    func setPreference(_ preference: String) {
        guard ["light", "dark"].contains(preference) else { return }
        RouteMakerAppearance.save(preference)
    }
}

@objcMembers
final class RouteMakerSessionModule: NSObject, LynxModule {
    static var name: String { "RouteMakerSession" }

    static var methodLookup: [String: String] {
        [
            "getToken": NSStringFromSelector(#selector(getToken(_:))),
            "setToken": NSStringFromSelector(#selector(setToken(_:))),
            "clearToken": NSStringFromSelector(#selector(clearToken))
        ]
    }

    private let defaults = UserDefaults.standard
    private static let tokenKey = "routemaker.session"

    init(param: Any) {
        super.init()
    }

    override init() {
        super.init()
    }

    func getToken(_ completion: (NSString) -> Void) {
        completion((defaults.string(forKey: Self.tokenKey) ?? "") as NSString)
    }

    func setToken(_ token: String) {
        defaults.set(token, forKey: Self.tokenKey)
    }

    func clearToken() {
        defaults.removeObject(forKey: Self.tokenKey)
    }
}

@objcMembers
final class RouteMakerShareModule: NSObject, LynxModule {
    static var name: String { "RouteMakerShare" }

    static var methodLookup: [String: String] {
        ["share": NSStringFromSelector(#selector(share(_:title:completion:)))]
    }

    init(param: Any) {
        super.init()
    }

    override init() {
        super.init()
    }

    func share(_ url: String, title: String, completion: @escaping (NSString) -> Void) {
        DispatchQueue.main.async {
            let activity = UIActivityViewController(
                activityItems: [url],
                applicationActivities: nil
            )
            guard let presenter = Self.topViewController() else {
                completion("unavailable")
                return
            }
            if let popover = activity.popoverPresentationController {
                popover.sourceView = presenter.view
                popover.sourceRect = CGRect(
                    x: presenter.view.bounds.midX,
                    y: presenter.view.bounds.midY,
                    width: 0,
                    height: 0
                )
            }
            presenter.present(activity, animated: true)
            completion("opened")
        }
    }

    private static func topViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let window = scenes.flatMap(\.windows).first { $0.isKeyWindow }
        var controller = window?.rootViewController
        while let presented = controller?.presentedViewController {
            controller = presented
        }
        return controller
    }
}

@objcMembers
final class RouteMakerNavigationModule: NSObject, LynxModule {
    static var name: String { "RouteMakerNavigation" }

    static var methodLookup: [String: String] {
        ["openExternal": NSStringFromSelector(#selector(openExternal(_:replace:completion:)))]
    }

    init(param: Any) {
        super.init()
    }

    override init() {
        super.init()
    }

    func openExternal(
        _ url: String,
        replace _: Bool,
        completion: @escaping LynxCallbackBlock
    ) {
        guard
            let target = URL(string: url),
            ["http", "https"].contains(target.scheme?.lowercased() ?? ""),
            target.host != nil
        else {
            completion(NSNumber(value: false))
            return
        }
        DispatchQueue.main.async {
            UIApplication.shared.open(target) { success in
                completion(NSNumber(value: success))
            }
        }
    }
}
