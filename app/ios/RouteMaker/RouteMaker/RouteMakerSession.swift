import Foundation
import Lynx
import Security

/// The sign-in token lives in the Keychain; its `ThisDeviceOnly` accessibility keeps it out of
/// backups and device transfers.
enum RouteMakerSessionStore {
    private static let launchedKey = "routemaker.launched"
    private static let identity: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: "rocks.routemaker.app",
        kSecAttrAccount as String: "routemaker.session"
    ]

    static var token: String {
        var query = identity
        query[kSecReturnData as String] = true
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data
        else { return "" }
        return String(decoding: data, as: UTF8.self)
    }

    static func save(_ token: String) {
        clear()
        var entry = identity
        entry[kSecValueData as String] = Data(token.utf8)
        entry[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(entry as CFDictionary, nil)
    }

    static func clear() {
        SecItemDelete(identity as CFDictionary)
    }

    /// Keychain items outlive the app, but UserDefaults do not: no flag means a fresh install,
    /// which must not inherit the previous install's live session.
    static func discardIfReinstalled() {
        guard !UserDefaults.standard.bool(forKey: launchedKey) else { return }
        clear()
        UserDefaults.standard.set(true, forKey: launchedKey)
    }
}

@objcMembers
final class RouteMakerSessionModule: RouteMakerModule, LynxModule {
    static var name: String { "RouteMakerSession" }

    static var methodLookup: [String: String] {
        [
            "getToken": NSStringFromSelector(#selector(getToken(_:))),
            "setToken": NSStringFromSelector(#selector(setToken(_:))),
            "clearToken": NSStringFromSelector(#selector(clearToken))
        ]
    }

    func getToken(_ completion: @escaping LynxCallbackBlock) {
        completion(RouteMakerSessionStore.token as NSString)
    }

    func setToken(_ token: String) {
        RouteMakerSessionStore.save(token)
    }

    func clearToken() {
        RouteMakerSessionStore.clear()
    }
}
