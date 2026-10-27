package rocks.routemaker.app

import android.util.Log
import java.io.Serializable
import org.json.JSONObject

/** What the map screen needs to draw; handed to the activity inside its Intent. */
data class MapScene(
    val gyms: List<GymLocation>,
    val dark: Boolean,
    val style: String,
    val centerLatitude: Double,
    val centerLongitude: Double,
    val zoom: Double,
    val locationZoom: Double,
) : Serializable {

    companion object {
        private const val TAG = "MapScene"

        // The scene comes from our own JS, so a malformed one is a bug: log it and open nothing.
        fun parse(json: String): MapScene? = runCatching {
            val root = JSONObject(json)
            val gyms = root.getJSONArray("gyms")
            MapScene(
                gyms = List(gyms.length()) { index ->
                    val gym = gyms.getJSONObject(index)
                    GymLocation(
                        id = gym.getString("id"),
                        label = listOf(gym.getString("name"), gym.getString("address"))
                            .filter { it.isNotBlank() }
                            .joinToString(", "),
                        latitude = gym.getDouble("latitude"),
                        longitude = gym.getDouble("longitude"),
                    )
                },
                dark = root.getString("theme") == "dark",
                style = root.getString("style"),
                centerLatitude = root.getDouble("centerLatitude"),
                centerLongitude = root.getDouble("centerLongitude"),
                zoom = root.getDouble("zoom"),
                locationZoom = root.getDouble("locationZoom"),
            )
        }.onFailure { Log.w(TAG, "Rejected a malformed map scene", it) }.getOrNull()
    }
}

data class GymLocation(
    val id: String,
    val label: String,
    val latitude: Double,
    val longitude: Double,
) : Serializable
