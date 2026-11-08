import { WidgetType, EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

class RubyWidget extends WidgetType {
  constructor(readonly baseText: string, readonly rubyText: string) {
    super();
  }

  toDOM() {
    const rubyEl = document.createElement('ruby');
    rubyEl.className = 'novel-live-ruby';
    rubyEl.textContent = this.baseText;

    const rpOpen = document.createElement('rp');
    rpOpen.textContent = '(';
    const rt = document.createElement('rt');
    rt.className = 'novel-live-rt';
    rt.textContent = this.rubyText;
    const rpClose = document.createElement('rp');
    rpClose.textContent = ')';

    rubyEl.appendChild(rpOpen);
    rubyEl.appendChild(rt);
    rubyEl.appendChild(rpClose);
    return rubyEl;
  }

  eq(other: RubyWidget) {
    return this.baseText === other.baseText && this.rubyText === other.rubyText;
  }

  ignoreEvent() {
    return false;
  }
}

class BoutenWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }

  toDOM() {
    const span = document.createElement('span');
    span.className = 'novel-live-bouten';
    span.textContent = this.text;
    return span;
  }

  eq(other: BoutenWidget) {
    return this.text === other.text;
  }

  ignoreEvent() {
    return false;
  }
}

interface MatchItem {
  from: number;
  to: number;
  widget: WidgetType;
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const matches: MatchItem[] = [];

  const rubyRegex = /[|｜]([^《\r\n]+)《([^》\r\n]+)》/g;
  const boutenRegex = /《《([^》\r\n]+)》》/g;

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.sliceDoc(from, to);

    // Find ruby matches
    rubyRegex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rubyRegex.exec(text)) !== null) {
      const start = from + m.index;
      const end = start + m[0].length;
      const base = m[1];
      const ruby = m[2];

      const cursorOverlaps = view.state.selection.ranges.some(
        (r) => r.from <= end && r.to >= start
      );

      if (!cursorOverlaps) {
        matches.push({
          from: start,
          to: end,
          widget: new RubyWidget(base, ruby),
        });
      }
    }

    // Find bouten matches
    boutenRegex.lastIndex = 0;
    while ((m = boutenRegex.exec(text)) !== null) {
      const start = from + m.index;
      const end = start + m[0].length;
      const content = m[1];

      const cursorOverlaps = view.state.selection.ranges.some(
        (r) => r.from <= end && r.to >= start
      );

      if (!cursorOverlaps) {
        matches.push({
          from: start,
          to: end,
          widget: new BoutenWidget(content),
        });
      }
    }
  }

  // Sort by 'from' ascending, removing any overlapping ranges
  matches.sort((a, b) => a.from - b.from);

  let lastTo = -1;
  for (const item of matches) {
    if (item.from >= lastTo) {
      builder.add(
        item.from,
        item.to,
        Decoration.replace({
          widget: item.widget,
        })
      );
      lastTo = item.to;
    }
  }

  return builder.finish();
}

const rubyPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

const rubyBaseTheme = EditorView.baseTheme({
  '.novel-live-ruby': {
    rubyPosition: 'over',
    display: 'inline-ruby',
    lineHeight: 'inherit',
  },
  '.novel-live-rt': {
    fontSize: '0.52em',
    letterSpacing: '0',
    userSelect: 'none',
    opacity: '0.82',
    lineHeight: '1',
    transform: 'translateY(-0.15em)',
    fontWeight: 'normal',
  },
  '.novel-live-bouten': {
    textEmphasis: 'filled sesame',
    WebkitTextEmphasis: 'filled sesame',
    textEmphasisPosition: 'over right',
    WebkitTextEmphasisPosition: 'over right',
    display: 'inline',
  },
});

export const rubyExtension = [rubyPlugin, rubyBaseTheme];
