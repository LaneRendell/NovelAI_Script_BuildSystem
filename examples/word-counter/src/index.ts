/**
 * Word Counter Script
 * A simple utility to count words and characters in your story
 */

interface CountStats {
    words: number;
    characters: number;
    charactersNoSpaces: number;
    paragraphs: number;
}

/**
 * Count words, characters, and paragraphs in text
 */
function countText(text: string): CountStats {
    const trimmed = text.trim();

    if (trimmed.length === 0) {
        return { words: 0, characters: 0, charactersNoSpaces: 0, paragraphs: 0 };
    }

    const words = trimmed.split(/\s+/).filter(w => w.length > 0).length;
    const characters = trimmed.length;
    const charactersNoSpaces = trimmed.replace(/\s/g, '').length;
    const paragraphs = trimmed.split(/\n\n+/).filter(p => p.trim().length > 0).length;

    return { words, characters, charactersNoSpaces, paragraphs };
}

/**
 * Format count stats for display
 */
function formatStats(stats: CountStats): string {
    return `📊 Words: ${stats.words.toLocaleString()}
📝 Characters: ${stats.characters.toLocaleString()}
🔤 Characters (no spaces): ${stats.charactersNoSpaces.toLocaleString()}
📄 Paragraphs: ${stats.paragraphs.toLocaleString()}`;
}

/**
 * Count the current document
 */
async function countDocument() {
    const text = await api.v1.document.textFromSelection();
    const stats = countText(text);

    await api.v1.ui.toast(formatStats(stats), {
        autoClose: 5000,
        type: "info",
    });

    api.v1.log("Document stats:", stats);
}

/**
 * Count selected text only
 */
async function countSelection() {
    const selection = await api.v1.editor.selection.get();
    const selectedText = await api.v1.document.textFromSelection({
        from: selection.from,
        to: selection.to,
    });

    if (!selectedText || selectedText.trim().length === 0) {
        await api.v1.ui.toast("No text selected", {
            autoClose: 2000,
            type: "warning",
        });
        return;
    }

    const stats = countText(selectedText);

    await api.v1.ui.toast(`Selection:\n${formatStats(stats)}`, {
        autoClose: 5000,
        type: "info",
    });

    api.v1.log("Selection stats:", stats);
}

/**
 * Initialize the script
 */
async function init() {
    api.v1.log("Word Counter initialized");

    // Register toolbar buttons
    const countDocButton = api.v1.ui.extension.toolbarButton({
        id: "word-counter-doc",
        text: "Count Doc",
        callback: countDocument,
    });

    const countSelButton = api.v1.ui.extension.toolbarButton({
        id: "word-counter-sel",
        text: "Count Sel",
        callback: countSelection,
    });

    await api.v1.ui.register([countDocButton, countSelButton]);

    api.v1.log("Word Counter ready - use toolbar buttons to count");
}

init();
