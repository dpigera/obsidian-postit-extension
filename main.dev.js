const { Plugin, PluginSettingTab, Setting, Notice } = require('obsidian');

// Module-level variable to ensure only one sticky note can exist
let STICKY_NOTE_INSTANCE = null;

const DEFAULT_SETTINGS = {
    // No shortcut key settings needed anymore
    defaultFolder: '/' // Default to root folder
};

class StickyNotesPlugin extends Plugin {
    settings = DEFAULT_SETTINGS;
    
    async onload() {
        console.log('Loading Sticky Notes plugin');
        
        // Reset module-level variable
        STICKY_NOTE_INSTANCE = null;
        
        try {
            // Load settings first
            const loadedData = await this.loadData();
            this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData || {});
            
            // Add settings tab
            this.addSettingTab(new StickyNotesSettingTab(this.app, this));
            
            // Add styles
            this.addStyles();
            
            // Add command palette command
            this.addCommand({
                id: 'create-sticky-note',
                name: 'Create Sticky Note',
                editorCallback: (editor, view) => {
                    this.handleStickyNoteRequest(editor, view);
                }
            });
            
            // Show a notice to confirm the plugin is loaded
            new Notice('Sticky Notes plugin loaded. Use the command palette to create a sticky note.');
            
            console.log('Sticky Notes plugin loaded successfully');
        } catch (error) {
            console.error('Error loading Sticky Notes plugin:', error);
        }
    }
    
    // Centralized handler for sticky note requests
    handleStickyNoteRequest(editor, view) {
        // Check if a sticky note already exists
        if (STICKY_NOTE_INSTANCE) {
            console.log('Sticky note already exists, focusing it');
            this.focusExistingStickyNote();
            return;
        }
        
        // Create a new sticky note
        console.log('Creating sticky note...');
        this.createStickyNote(editor, view);
    }
    
    // Focus the existing sticky note
    focusExistingStickyNote() {
        if (!STICKY_NOTE_INSTANCE || !STICKY_NOTE_INSTANCE.textAreaEl) {
            return;
        }
        
        // Add a pulse animation
        STICKY_NOTE_INSTANCE.containerEl.classList.add('sticky-note-focus');
        
        // Focus the textarea
        STICKY_NOTE_INSTANCE.textAreaEl.focus();
        
        // Show a notice
        new Notice('Sticky note already exists');
        
        // Remove the animation class after it completes
        setTimeout(() => {
            if (STICKY_NOTE_INSTANCE && STICKY_NOTE_INSTANCE.containerEl) {
                STICKY_NOTE_INSTANCE.containerEl.classList.remove('sticky-note-focus');
            }
        }, 500);
    }

    addStyles() {
        // Add the CSS directly to the document
        const styleEl = document.createElement('style');
        styleEl.id = 'sticky-notes-styles';
        styleEl.textContent = `
            .sticky-note {
                background-color: #F8D406;
                color: black;
                padding: 10px;
                border-radius: 5px;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
                z-index: 1000;
                min-width: 200px;
                min-height: 150px;
                position: absolute;
                font-family: var(--font-text);
                display: flex;
                flex-direction: column;
            }
            
            .sticky-note textarea {
                width: 100%;
                height: 100%;
                border: none;
                resize: none;
                background-color: transparent;
                outline: none;
                font-family: inherit;
                color: black;
                flex-grow: 1;
            }
            
            .sticky-note textarea:focus {
                border: none;
                outline: none;
                box-shadow: none;
            }
            
            .sticky-note textarea::placeholder {
                color: oklch(0.414 0.112 45.904);
                opacity: 1;
            }
            
            .sticky-note-header {
                display: flex;
                justify-content: flex-end;
                margin-bottom: 5px;
            }
            
            .sticky-note-close {
                cursor: pointer;
                opacity: 0.7;
                color: oklch(0.414 0.112 45.904);
            }
            
            .sticky-note-close:hover {
                opacity: 1;
            }
            
            .sticky-note-help {
                text-align: right;
                font-size: 0.8em;
                margin-top: 5px;
                color: oklch(0.414 0.112 45.904);
                opacity: 0.8;
            }
            
            .sticky-note-focus {
                animation: sticky-note-pulse 0.5s ease-in-out;
            }
            
            @keyframes sticky-note-pulse {
                0% { transform: scale(1); box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2); }
                50% { transform: scale(1.05); box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3); }
                100% { transform: scale(1); box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2); }
            }
        `;
        document.head.appendChild(styleEl);
    }

    onunload() {
        console.log('Unloading Sticky Notes plugin');
        
        // Remove any sticky note
        if (STICKY_NOTE_INSTANCE) {
            this.removeStickyNote();
        }
        
        // Reset module-level variable
        STICKY_NOTE_INSTANCE = null;
        
        // Remove styles
        const styleEl = document.getElementById('sticky-notes-styles');
        if (styleEl) styleEl.remove();
    }

    async saveSettings() {
        try {
            await this.saveData(this.settings);
        } catch (error) {
            console.error('Failed to save settings:', error);
            new Notice('Failed to save settings');
        }
    }

    createStickyNote(editor, view) {
        try {
            console.log('Creating sticky note');
            
            // Get cursor position for focus restoration and vertical positioning
            const cursor = editor.getCursor();
            
            // Store the active leaf for later focus restoration
            const activeLeaf = this.app.workspace.activeLeaf;
            
            // Get the editor viewport
            const editorViewport = view.contentEl.querySelector('.cm-scroller');
            if (!editorViewport) {
                console.error('Editor viewport not found');
                return;
            }
            
            // Get the editor element
            const editorEl = view.contentEl.querySelector('.cm-editor');
            if (!editorEl) {
                console.error('Editor element not found');
                return;
            }
            
            // Get the line element at the cursor position
            const lineEl = editorEl.querySelector(`.cm-line:nth-child(${cursor.line + 1})`);
            if (!lineEl) {
                console.error('Line element not found');
                return;
            }
            
            // Get the position of the line element
            const lineRect = lineEl.getBoundingClientRect();
            
            // Get the dimensions of the editor viewport
            const viewportRect = editorViewport.getBoundingClientRect();
            
            // Set initial size for the sticky note
            const stickyNoteWidth = 200; // Default width from CSS
            const stickyNoteHeight = 150; // Default height from CSS
            
            // Create sticky note container
            const containerEl = document.createElement('div');
            containerEl.classList.add('sticky-note');
            
            // Use fixed positioning to handle scrolling
            containerEl.style.position = 'fixed';
            
            // Position the sticky note at the left edge of the current editor view
            // and vertically aligned with the cursor
            // containerEl.style.left = `${viewportRect.left}px`;
            containerEl.style.left = null;
            containerEl.style.top = `${lineRect.top}px`;
            
            console.log('Positioning sticky note at:', {
                left: containerEl.style.left,
                top: containerEl.style.top,
                editorLeft: viewportRect.left,
                lineTop: lineRect.top
            });
            
            // Create header with close button
            const headerEl = document.createElement('div');
            headerEl.classList.add('sticky-note-header');
            
            const closeButton = document.createElement('span');
            closeButton.classList.add('sticky-note-close');
            closeButton.textContent = '✕';
            closeButton.addEventListener('click', () => {
                this.removeStickyNote();
                // Return focus to the editor
                this.returnFocusToEditor();
                // Now it's safe to clear the instance
                STICKY_NOTE_INSTANCE = null;
            });
            
            headerEl.appendChild(closeButton);
            containerEl.appendChild(headerEl);

            // Create textarea for input
            const textAreaEl = document.createElement('textarea');
            textAreaEl.placeholder = 'Type your note here...';

            // Handle Enter key to save the note
            textAreaEl.addEventListener('keydown', async (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const noteContent = textAreaEl?.value;
                    if (noteContent) {
                        await this.saveAsNewNote(noteContent);
                    }
                    this.removeStickyNote();
                    // Return focus to the editor
                    this.returnFocusToEditor();
                    // Now it's safe to clear the instance
                    STICKY_NOTE_INSTANCE = null;
                }
                // Handle Escape key to cancel
                if (e.key === 'Escape') {
                    this.removeStickyNote();
                    // Return focus to the editor
                    this.returnFocusToEditor();
                    // Now it's safe to clear the instance
                    STICKY_NOTE_INSTANCE = null;
                }
            });

            // Add textarea to sticky note
            containerEl.appendChild(textAreaEl);
            
            // Add help text in the bottom right corner
            const helpTextEl = document.createElement('div');
            helpTextEl.classList.add('sticky-note-help');
            helpTextEl.textContent = "'Enter' to Save";
            containerEl.appendChild(helpTextEl);
            
            // Add sticky note to the editor viewport
            editorViewport.appendChild(containerEl);
            
            // Focus the textarea
            textAreaEl.focus();
            
            // Store the sticky note instance with all necessary references
            STICKY_NOTE_INSTANCE = {
                containerEl,
                textAreaEl,
                editorViewport,
                editor,
                cursorPosition: cursor,
                activeLeaf: activeLeaf,
                view: view
            };
            
            console.log('Sticky note created successfully');
            new Notice('Sticky note created');
            
        } catch (error) {
            console.error('Error creating sticky note:', error);
        }
    }
    
    // Helper method to return focus to the editor
    returnFocusToEditor() {
        try {
            if (!STICKY_NOTE_INSTANCE) {
                console.log('No sticky note instance to return focus from');
                return;
            }
            
            // Use the stored activeLeaf if available
            if (STICKY_NOTE_INSTANCE.activeLeaf && STICKY_NOTE_INSTANCE.activeLeaf.view) {
                const view = STICKY_NOTE_INSTANCE.activeLeaf.view;
                
                // Make sure the view has an editor
                if (view.editor) {
                    // Focus the editor
                    view.editor.focus();
                    
                    // Restore the cursor position
                    if (STICKY_NOTE_INSTANCE.cursorPosition) {
                        view.editor.setCursor(STICKY_NOTE_INSTANCE.cursorPosition);
                    }
                    
                    console.log('Returned focus to editor with cursor at:', STICKY_NOTE_INSTANCE.cursorPosition);
                    return;
                }
            }
            
            // Fallback to getting the current active leaf
            const activeLeaf = this.app.workspace.activeLeaf;
            if (activeLeaf && activeLeaf.view && activeLeaf.view.editor) {
                // Focus the editor
                activeLeaf.view.editor.focus();
                
                // Restore the cursor position if we have it
                if (STICKY_NOTE_INSTANCE.cursorPosition) {
                    activeLeaf.view.editor.setCursor(STICKY_NOTE_INSTANCE.cursorPosition);
                }
                
                console.log('Returned focus to current active editor');
            } else {
                console.log('Could not find any editor to return focus to');
            }
        } catch (error) {
            console.error('Error returning focus to editor:', error);
        }
    }

    getCursorCoordinates(editor, view) {
        try {
            // Get the cursor position
            const cursor = editor.getCursor();
            
            // Get the editor element
            const editorEl = view.contentEl.querySelector('.cm-editor');
            if (!editorEl) return null;
            
            // Get the line element at the cursor position
            const lineEl = editorEl.querySelector(`.cm-line:nth-child(${cursor.line + 1})`);
            if (!lineEl) return null;
            
            // Get the position of the line element
            const lineRect = lineEl.getBoundingClientRect();
            
            // Calculate approximate position based on character position
            // This is a simplified approach and might need adjustment
            const charWidth = 8; // Approximate character width in pixels
            const left = lineRect.left + cursor.ch * charWidth;
            const top = lineRect.top;
            
            return { left, top };
        } catch (error) {
            console.error('Error getting cursor coordinates:', error);
            return null;
        }
    }

    removeStickyNote() {
        try {
            if (STICKY_NOTE_INSTANCE && STICKY_NOTE_INSTANCE.containerEl && STICKY_NOTE_INSTANCE.containerEl.parentNode) {
                STICKY_NOTE_INSTANCE.containerEl.parentNode.removeChild(STICKY_NOTE_INSTANCE.containerEl);
                
                // Don't immediately set to null, as we might need the editor reference
                // for returnFocusToEditor
            }
        } catch (error) {
            console.error('Error removing sticky note:', error);
        }
    }

    async saveAsNewNote(content) {
        try {
            if (!this.app || !this.app.vault) {
                throw new Error('App or vault not initialized');
            }
            
            // Get the first 15 characters for the title
            let title = content.trim().substring(0, 15);
            
            // Add ellipsis if the content is longer than 15 characters
            if (content.trim().length > 15) {
                title += '...';
            }
            
            // If somehow we have an empty title, use the current date/time
            if (!title) {
                title = `Note ${new Date().toISOString().replace(/[:.]/g, '-')}`;
            }
            
            // Ensure the filename is valid
            const filename = `${title.replace(/[\\/:*?"<>|]/g, '-')}.md`;
            
            // Get the default folder path from settings
            let folderPath = this.settings.defaultFolder || '/';
            
            // Ensure the path starts with a slash
            if (!folderPath.startsWith('/')) {
                folderPath = '/' + folderPath;
            }
            
            // Remove trailing slash if it's not just the root
            if (folderPath.length > 1 && folderPath.endsWith('/')) {
                folderPath = folderPath.slice(0, -1);
            }
            
            // Combine folder path and filename
            const fullPath = folderPath === '/' ? filename : `${folderPath}/${filename}`;
            
            try {
                // Check if the folder exists
                if (folderPath !== '/') {
                    // Remove leading slash for the folder check
                    const folderPathWithoutLeadingSlash = folderPath.substring(1);
                    
                    // Check if the folder exists
                    const folderExists = await this.app.vault.adapter.exists(folderPathWithoutLeadingSlash);
                    
                    if (!folderExists) {
                        // Try to create the folder
                        try {
                            await this.app.vault.createFolder(folderPathWithoutLeadingSlash);
                            console.log(`Created folder: ${folderPathWithoutLeadingSlash}`);
                        } catch (folderError) {
                            console.error(`Failed to create folder: ${folderPathWithoutLeadingSlash}`, folderError);
                            // Fall back to root folder
                            await this.app.vault.create(filename, content);
                            new Notice(`Note saved as "${filename}" in root folder (default folder not found)`);
                            return;
                        }
                    }
                }
                
                // Save to the specified path
                await this.app.vault.create(fullPath, content);
                new Notice(`Note saved as "${fullPath}"`);
                
            } catch (error) {
                console.error(`Error saving to path ${fullPath}:`, error);
                // Fall back to root folder
                try {
                    await this.app.vault.create(filename, content);
                    new Notice(`Note saved as "${filename}" in root folder (fallback)`);
                } catch (rootError) {
                    console.error('Error saving to root folder:', rootError);
                    new Notice('Failed to save note: ' + rootError.message);
                }
            }
            
        } catch (error) {
            console.error('Error saving note:', error);
            new Notice('Failed to save note: ' + error.message);
        }
    }
}

class StickyNotesSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const {containerEl} = this;

        containerEl.empty();

        containerEl.createEl('h2', {text: 'Sticky Notes Settings'});
        
        // Add setting for default folder
        new Setting(containerEl)
            .setName('Default Folder')
            .setDesc('Specify a folder path where sticky notes will be saved. Use "/" for the root folder.')
            .addText(text => text
                .setPlaceholder('/')
                .setValue(this.plugin.settings.defaultFolder || '/')
                .onChange(async (value) => {
                    // Ensure the path starts with a slash
                    if (!value.startsWith('/')) {
                        value = '/' + value;
                    }
                    
                    // Remove trailing slash if it's not just the root
                    if (value.length > 1 && value.endsWith('/')) {
                        value = value.slice(0, -1);
                    }
                    
                    this.plugin.settings.defaultFolder = value;
                    await this.plugin.saveSettings();
                    
                    // Notify user
                    // new Notice(`Default folder set to: ${value}`);
                }));
    }
}

module.exports = StickyNotesPlugin; 