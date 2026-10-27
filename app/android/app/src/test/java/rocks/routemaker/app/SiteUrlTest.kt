package rocks.routemaker.app

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SiteUrlTest {
    private val site = "https://routemaker-worker.nandium.workers.dev"

    @Test
    fun acceptsPagesOfTheSite() {
        assertTrue(isSiteUrl("$site/routes/new", site))
        assertTrue(isSiteUrl("$site/gyms/map#code=abc123", site))
        assertTrue(isSiteUrl("$site/feed?view=following", site))
        assertTrue(isSiteUrl(site, site))
    }

    @Test
    fun acceptsTheLocalDevelopmentSite() {
        assertTrue(isSiteUrl("http://10.0.2.2:8787/gyms/map", "http://10.0.2.2:8787"))
    }

    @Test
    fun rejectsOtherHosts() {
        assertFalse(isSiteUrl("https://evil.example/routes/new", site))
        assertFalse(isSiteUrl("$site.evil.example/routes/new", site))
        assertFalse(isSiteUrl("${site}evil/routes/new", site))
    }

    @Test
    fun rejectsUrlsThatOnlyLookLikeTheSite() {
        assertFalse(isSiteUrl("$site@evil.example/", site))
        assertFalse(isSiteUrl("https://evil.example\\@routemaker-worker.nandium.workers.dev/", site))
        assertFalse(isSiteUrl("https://evil.example/?next=$site/", site))
    }

    @Test
    fun rejectsOtherSchemes() {
        assertFalse(isSiteUrl("http://routemaker-worker.nandium.workers.dev/routes/new", site))
        assertFalse(isSiteUrl("javascript:alert(1)", site))
        assertFalse(isSiteUrl("", site))
    }
}
