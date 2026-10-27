import Foundation
import Lynx
import UIKit

@objcMembers
final class RouteMakerShareModule: RouteMakerModule, LynxModule {
    static var name: String { "RouteMakerShare" }

    static var methodLookup: [String: String] {
        ["share": NSStringFromSelector(#selector(share(_:title:completion:)))]
    }

    // The share sheet previews the link itself, so the title is not needed.
    func share(_ url: String, title _: String, completion: @escaping LynxCallbackBlock) {
        DispatchQueue.main.async {
            guard let presenter = UIApplication.shared.topViewController else {
                completion("unavailable" as NSString)
                return
            }
            let activity = UIActivityViewController(
                activityItems: [URL(string: url) ?? url],
                applicationActivities: nil
            )
            // iPad presents the sheet as a popover, which needs an anchor.
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
            completion("opened" as NSString)
        }
    }
}
