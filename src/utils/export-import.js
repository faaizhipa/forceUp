
const ExportImport = {
  // --- EXPORT FUNCTIONS ---

  async exportJSON() {
    const data = await Storage.getAllNotes();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    this.downloadFile(blob, 'smart_notes_backup.json');
  },

  async exportMarkdown() {
    const data = await Storage.getAllNotes();
    let mdContent = '# Smart Notes Export\n\n';
    
    for (const [url, notes] of Object.entries(data)) {
      mdContent += `## URL: ${url}\n\n`;
      notes.forEach(note => {
        mdContent += `### ${note.title}\n`;
        mdContent += `*Created: ${new Date(note.createdAt).toLocaleString()}*\n\n`;
        mdContent += `${note.content}\n\n---\n\n`;
      });
    }

    const blob = new Blob([mdContent], { type: 'text/markdown' });
    this.downloadFile(blob, 'smart_notes_backup.md');
  },

  async exportText() {
    const data = await Storage.getAllNotes();
    let txtContent = 'SMART NOTES EXPORT\n==================\n\n';

    for (const [url, notes] of Object.entries(data)) {
      txtContent += `URL: ${url}\n----------------------------------------\n`;
      notes.forEach(note => {
        txtContent += `Title: ${note.title}\n`;
        txtContent += `Date: ${new Date(note.createdAt).toLocaleString()}\n`;
        txtContent += `Content:\n${note.content}\n\n`;
        txtContent += `-------------------\n\n`;
      });
    }

    const blob = new Blob([txtContent], { type: 'text/plain' });
    this.downloadFile(blob, 'smart_notes_backup.txt');
  },

  async exportXML() {
    const data = await Storage.getAllNotes();
    let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n<notes>\n';

    for (const [url, notes] of Object.entries(data)) {
      xmlContent += `  <url location="${this.escapeXML(url)}">\n`;
      notes.forEach(note => {
        xmlContent += `    <note id="${note.id}">\n`;
        xmlContent += `      <title>${this.escapeXML(note.title)}</title>\n`;
        xmlContent += `      <content>${this.escapeXML(note.content)}</content>\n`;
        xmlContent += `      <createdAt>${note.createdAt}</createdAt>\n`;
        xmlContent += `      <updatedAt>${note.updatedAt}</updatedAt>\n`;
        xmlContent += `    </note>\n`;
      });
      xmlContent += `  </url>\n`;
    }
    xmlContent += '</notes>';

    const blob = new Blob([xmlContent], { type: 'application/xml' });
    this.downloadFile(blob, 'smart_notes_backup.xml');
  },

  downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  escapeXML(str) {
    if (!str) return '';
    return str.replace(/[<>&'"]/g, c => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
      }
    });
  },

  // --- IMPORT FUNCTIONS ---

  async handleImport(file) {
    const text = await file.text();
    const type = file.name.split('.').pop().toLowerCase();

    try {
      let importedData = {};

      if (type === 'json') {
        importedData = JSON.parse(text);
      } else if (type === 'xml') {
        importedData = this.parseXML(text);
      } else if (type === 'md') {
        importedData = this.parseMarkdown(text);
      } else if (type === 'txt') {
        importedData = this.parseText(text);
      } else {
        alert('Unsupported file type.');
        return; 
      }

      await this.mergeData(importedData);
      alert('Import successful!');
      return true;
    } catch (e) {
      console.error(e);
      alert('Failed to import file: ' + e.message);
      return false;
    }
  },

  parseXML(xmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    const notesMap = {};

    const urlNodes = xmlDoc.getElementsByTagName('url');
    for (let i = 0; i < urlNodes.length; i++) {
      const urlNode = urlNodes[i];
      const location = urlNode.getAttribute('location');
      const noteNodes = urlNode.getElementsByTagName('note');
      
      notesMap[location] = [];

      for (let j = 0; j < noteNodes.length; j++) {
        const n = noteNodes[j];
        notesMap[location].push({
          id: n.getAttribute('id') || crypto.randomUUID(),
          title: n.getElementsByTagName('title')[0]?.textContent || '',
          content: n.getElementsByTagName('content')[0]?.textContent || '',
          createdAt: parseInt(n.getElementsByTagName('createdAt')[0]?.textContent) || Date.now(),
          updatedAt: parseInt(n.getElementsByTagName('updatedAt')[0]?.textContent) || Date.now()
        });
      }
    }
    return notesMap;
  },

  parseMarkdown(mdText) {
    // Basic parser based on the Export format
    const notesMap = {};
    const urlSections = mdText.split('## URL: ');
    
    // Skip the first split if it's just the header
    for (let i = 1; i < urlSections.length; i++) {
      const section = urlSections[i];
      const urlEndIdx = section.indexOf('\n');
      const url = section.substring(0, urlEndIdx).trim();
      const content = section.substring(urlEndIdx).trim();
      
      notesMap[url] = [];
      
      // Split notes by title header '### '
      const noteSections = content.split('### ');
      for (let j = 1; j < noteSections.length; j++) {
        const noteBlock = noteSections[j];
        const titleEndIdx = noteBlock.indexOf('\n');
        const title = noteBlock.substring(0, titleEndIdx).trim();
        
        // Extract body - remove '---' separator if present at end
        let body = noteBlock.substring(titleEndIdx).trim();
        
        // Remove 'Created: ...' line if present
        const createdMatch = body.match(/\*Created: (.*)\*/);
        let createdAt = Date.now();
        if (createdMatch) {
             createdAt = new Date(createdMatch[1]).getTime() || Date.now();
             body = body.replace(createdMatch[0], '').trim();
        }
        
        // Remove trailing ---
        body = body.replace(/---$/, '').trim();

        notesMap[url].push({
          id: crypto.randomUUID(),
          title: title,
          content: body,
          createdAt: createdAt,
          updatedAt: Date.now()
        });
      }
    }
    return notesMap;
  },

  parseText(txtText) {
    const notesMap = {};
    const urlSections = txtText.split('URL: ');
    
    // Skip first chunk (header)
    for (let i = 1; i < urlSections.length; i++) {
      const section = urlSections[i];
      const urlEndIdx = section.indexOf('\n');
      const url = section.substring(0, urlEndIdx).trim();
      
      notesMap[url] = [];
      
      // Notes are separated by dashed lines in my export: -------------------
      // But simpler to split by 'Title: ' if we assume strict format
      const noteBlocks = section.split('Title: ');
      
      for (let j = 1; j < noteBlocks.length; j++) {
        const block = noteBlocks[j];
        const lines = block.split('\n');
        const title = lines[0].trim();
        
        let content = '';
        let createdAt = Date.now();
        let readingContent = false;
        
        for (let k = 1; k < lines.length; k++) {
          const line = lines[k];
          if (line.startsWith('Date: ')) {
             createdAt = new Date(line.replace('Date: ', '').trim()).getTime() || Date.now();
             continue;
          }
          if (line.startsWith('Content:')) {
            readingContent = true;
            continue;
          }
          if (line.startsWith('-------------------') || line.startsWith('----------------------------------------')) {
            // End of note or section
            break;
          }
          if (readingContent) {
            content += line + '\n';
          }
        }
        
        notesMap[url].push({
          id: crypto.randomUUID(),
          title: title,
          content: content.trim(),
          createdAt: createdAt,
          updatedAt: Date.now()
        });
      }
    }
    return notesMap;
  },

  async mergeData(newData) {
    // We want to merge, not overwrite blindly, or maybe user expects overwrite?
    // "Restore" usually implies overwriting or merging.
    // Let's merge: if note ID exists, update, else add.
    const currentData = await Storage.getAllNotes();

    for (const [url, notes] of Object.entries(newData)) {
      if (!currentData[url]) {
        currentData[url] = [];
      }
      
      notes.forEach(newNote => {
        const existingIdx = currentData[url].findIndex(n => n.id === newNote.id);
        if (existingIdx > -1) {
          // You might want a conflict resolution strategy, but for now, let's assume "latest wins" or "import wins"
          currentData[url][existingIdx] = newNote;
        } else {
          currentData[url].push(newNote);
        }
      });
    }

    await Storage.setAllNotes(currentData);
  }
};
