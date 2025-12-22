import { useState } from '../preact-setup.js';
import { html } from '../preact-setup.js';
import { Button } from '../ui/button.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select.js';
import { COPY_FORMATS } from '../lib/timezone-utils.js';

// Simple SVG Icons
const CopyIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32Zm-8,128H176V88a8,8,0,0,0-8-8H96V48H208Z"></path></svg>`;
const CheckIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M229.66,55.51a8,8,0,0,0-11.32-11.32l-136,136L37.66,135.51a8,8,0,0,0-11.32,11.32l50.7,50.75a8.05,8.05,0,0,0,5.66,2.34H83a8,8,0,0,0,5.65-2.31Z"></path></svg>`;

export function CopyActions({ conversions, className = '' }) {
  const [selectedFormat, setSelectedFormat] = useState('simple');
  const [copiedLine, setCopiedLine] = useState(false);
  const [copiedBlock, setCopiedBlock] = useState(false);

  const currentFormat = COPY_FORMATS.find(f => f.id === selectedFormat) || COPY_FORMATS[0];

  const handleCopyLine = async () => {
    const lines = conversions.map(c => {
      const label = c.timezone.split('/').pop() || c.timezone;
      // Ensure formatter is available
      const formatted = currentFormat.formatter ? currentFormat.formatter(c.date, c.timezone) : c.time;
      return `${label}: ${formatted}`;
    });
    const text = lines.join(', ');
    
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLine(true);
      // toast.success('Copied to clipboard'); // TODO: Integrate toast
      console.log('Copied to clipboard:', text);
      setTimeout(() => setCopiedLine(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleCopyBlock = async () => {
    const lines = conversions.map(c => {
      const tz = c.timezone.split('/').pop() || c.timezone;
      const formatted = currentFormat.formatter ? currentFormat.formatter(c.date, c.timezone) : c.time;
      return `${tz}: ${formatted}`;
    });
    const text = `Proposed Time:\n${lines.join('\n')}`;
    
    try {
      await navigator.clipboard.writeText(text);
      setCopiedBlock(true);
      // toast.success('Copied to clipboard'); // TODO: Integrate toast
      console.log('Copied to clipboard:', text);
      setTimeout(() => setCopiedBlock(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return html`
    <div className=${`flex items-center gap-4 p-4 bg-card border border-border rounded-lg ${className}`}>
      <div className="flex-1">
        <${Select} value=${selectedFormat} onValueChange=${setSelectedFormat}>
          <${SelectTrigger} className="w-[200px]">
            <${SelectValue} />
          <//>
          <${SelectContent}>
            ${COPY_FORMATS.map(format => html`
              <${SelectItem} key=${format.id} value=${format.id}>
                ${format.label}
              <//>
            `)}
          <//>
        <//>
      </div>

      <div className="flex gap-2">
        <${Button} onClick=${handleCopyLine} variant="secondary" className="gap-2">
          ${copiedLine ? html`<${CheckIcon} />` : html`<${CopyIcon} />`}
          Copy Line
        <//>
        <${Button} onClick=${handleCopyBlock} variant="secondary" className="gap-2">
          ${copiedBlock ? html`<${CheckIcon} />` : html`<${CopyIcon} />`}
          Copy Block
        <//>
      </div>
    </div>
  `;
}
