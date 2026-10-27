import Foundation
import UIKit

/// Base class of the bridge modules. Lynx creates a module with `init()`, but Swift's
/// `LynxModule` conformance also demands `init(param:)`, which Lynx calls only for modules
/// registered with a param. Declaring both here keeps the modules free of boilerplate.
class RouteMakerModule: NSObject {
    required init(param _: Any) {
        super.init()
    }

    override init() {
        super.init()
    }
}

extension Bundle {
    /// The site's origin from the ROUTEMAKER_API_BASE_URL build setting, without a trailing slash.
    var apiBaseURL: String {
        var url = object(forInfoDictionaryKey: "ROUTEMAKER_API_BASE_URL") as? String ?? ""
        while url.hasSuffix("/") {
            url.removeLast()
        }
        return url
    }
}

extension UIApplication {
    /// The view controller to present from: the frontmost one in the key window.
    var topViewController: UIViewController? {
        let scenes = connectedScenes.compactMap { $0 as? UIWindowScene }
        let window = scenes.flatMap(\.windows).first { $0.isKeyWindow }
        var controller = window?.rootViewController
        while let presented = controller?.presentedViewController {
            controller = presented
        }
        return controller
    }
}
