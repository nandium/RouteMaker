package rocks.routemaker.app

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The app's own test builds this fixture with nativeMapScene(), so the two cannot drift apart. */
class MapSceneTest {
    private val fixture = File("../../src/__tests__/fixtures/map-scene.json").readText()

    @Test
    fun parsesTheSceneTheAppSends() {
        val scene = MapScene.parse(fixture)

        assertNotNull(scene)
        scene!!
        assertEquals(
            listOf(
                GymLocation("gym-1", "Gravity Yard, 12 Kallang Way, Singapore", 1.3093, 103.8717),
                GymLocation("gym-2", "Boulder Hut", 51.5072, -0.1276),
            ),
            scene.gyms,
        )
        assertTrue(scene.dark)
        assertEquals("https://tiles.openfreemap.org/styles/fiord", scene.style)
        assertEquals(1.3, scene.centerLatitude, 0.0)
        assertEquals(103.8, scene.centerLongitude, 0.0)
        assertEquals(10.5, scene.zoom, 0.0)
        assertEquals(13.0, scene.locationZoom, 0.0)
    }

    @Test
    fun rejectsASceneWithoutGyms() {
        assertNull(MapScene.parse("""{"theme": "dark"}"""))
    }
}
