package rocks.routemaker.app

import java.io.File
import java.nio.ByteBuffer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The CSS family "RM Display" resolves by the name stored inside the font on iOS and by the name
 * the Application registers on Android, so the file must keep both its name and its weight.
 */
class DisplayFontTest {
    private val directory = File("../../resource/fonts")
    private val font = ByteBuffer.wrap(File(directory, "RMDisplay-800.ttf").readBytes())

    @Test
    fun isTrueTypeNamedRmDisplayAtWeight800() {
        assertEquals(0x00010000, font.getInt(0))
        assertEquals("RM Display", nameRecord(NAME_FAMILY))
        assertEquals(800, font.getShort(table("OS/2") + 4).toInt())
    }

    @Test
    fun shipsWithItsLicense() {
        assertTrue(File(directory, "OFL.txt").length() > 0)
    }

    private fun table(tag: String): Int {
        for (index in 0 until font.getShort(4).toInt()) {
            val entry = 12 + 16 * index
            val name = String(font.array(), entry, 4, Charsets.US_ASCII)
            if (name == tag) return font.getInt(entry + 8)
        }
        error("The font has no $tag table")
    }

    // Reads a Windows (platform 3) name record, which is UTF-16 big endian.
    private fun nameRecord(nameId: Int): String {
        val names = table("name")
        val strings = names + font.getShort(names + 4)
        for (index in 0 until font.getShort(names + 2).toInt()) {
            val record = names + 6 + 12 * index
            if (font.getShort(record).toInt() == 3 && font.getShort(record + 6).toInt() == nameId) {
                val length = font.getShort(record + 8).toInt()
                val offset = font.getShort(record + 10).toInt()
                return String(font.array(), strings + offset, length, Charsets.UTF_16BE)
            }
        }
        error("The font has no name $nameId")
    }

    private companion object {
        const val NAME_FAMILY = 1
    }
}
