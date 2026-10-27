import Foundation
import Lynx
import UIKit

/// Whether `url` is a page of `site` (the API base URL, without a trailing slash). Only the
/// site's own pages may open, so a URL and any sign-in code in it never reaches another host.
/// Comparing text avoids parsers that disagree about the host.
func isSiteURL(_ url: String, site: String) -> Bool {
    url == site || url.hasPrefix(site + "/")
}

@objcMembers
final class RouteMakerNavigationModule: RouteMakerModule, LynxModule {
    static var name: String { "RouteMakerNavigation" }

    static var methodLookup: [String: String] {
        ["openExternal": NSStringFromSelector(#selector(openExternal(_:replace:completion:)))]
    }

    // `replace` only matters to the web host, which can navigate in place.
    func openExternal(_ url: String, replace _: Bool, completion: @escaping LynxCallbackBlock) {
        guard
            isSiteURL(url, site: Bundle.main.apiBaseURL),
            let target = URL(string: url)
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
