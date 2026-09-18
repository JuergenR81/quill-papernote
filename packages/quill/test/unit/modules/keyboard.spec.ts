import '../../../src/quill.js';
import { describe, expect, test } from 'vitest';
import Keyboard, {
  SHORTKEY,
  normalize,
} from '../../../src/modules/keyboard.js';
import Quill, { Delta } from '../../../src/core.js';
import { SOFT_BREAK_CHARACTER } from '../../../src/blots/soft-break.js';

const assert = <T>(value: T | null | undefined): T => {
  if (value == null) {
    throw new Error();
  }
  return value;
};

const createKeyboardEvent = (key: string, override?: Partial<KeyboardEvent>) =>
  new KeyboardEvent('keydown', {
    key,
    shiftKey: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    ...override,
  });

describe('Keyboard', () => {
  describe('match', () => {
    test('no modifiers', () => {
      const binding = normalize({
        key: 'a',
      });
      expect(Keyboard.match(createKeyboardEvent('a'), assert(binding))).toBe(
        true,
      );
      expect(
        Keyboard.match(
          createKeyboardEvent('A', { altKey: true }),
          assert(binding),
        ),
      ).toBe(false);
    });

    test('simple modifier', () => {
      const binding = normalize({
        key: 'a',
        altKey: true,
      });
      expect(Keyboard.match(createKeyboardEvent('a'), assert(binding))).toBe(
        false,
      );
      expect(
        Keyboard.match(
          createKeyboardEvent('a', { altKey: true }),
          assert(binding),
        ),
      ).toBe(true);
    });

    test('optional modifier', () => {
      const binding = normalize({
        key: 'a',
        altKey: null,
      });
      expect(Keyboard.match(createKeyboardEvent('a'), assert(binding))).toBe(
        true,
      );
      expect(
        Keyboard.match(
          createKeyboardEvent('a', { altKey: true }),
          assert(binding),
        ),
      ).toBe(true);
    });

    test('shortkey modifier', () => {
      const binding = normalize({
        key: 'a',
        shortKey: true,
      });
      expect(Keyboard.match(createKeyboardEvent('a'), assert(binding))).toBe(
        false,
      );
      expect(
        Keyboard.match(
          createKeyboardEvent('a', { [SHORTKEY]: true }),
          assert(binding),
        ),
      ).toBe(true);
    });

    test('native shortkey modifier', () => {
      const binding = normalize({
        key: 'a',
        [SHORTKEY]: true,
      });
      expect(Keyboard.match(createKeyboardEvent('a'), assert(binding))).toBe(
        false,
      );
      expect(
        Keyboard.match(
          createKeyboardEvent('a', { [SHORTKEY]: true }),
          assert(binding),
        ),
      ).toBe(true);
    });
  });

  describe('Enter', () => {
    const createQuill = (contents: Delta) => {
      const quill = new Quill(
        document.body.appendChild(document.createElement('div')),
      );
      quill.setContents(contents);
      return quill;
    };

    const pressEnter = (quill: Quill, shiftKey = false) => {
      quill.root.dispatchEvent(createKeyboardEvent('Enter', { shiftKey }));
    };

    // A throw inside a dispatched listener never reaches the caller; it lands on window.
    const uncaughtDuring = (fn: () => void) => {
      const seen: string[] = [];
      const onError = (event: ErrorEvent) => {
        seen.push(event.message);
        event.preventDefault();
      };
      window.addEventListener('error', onError);
      try {
        fn();
      } finally {
        window.removeEventListener('error', onError);
      }
      return seen;
    };

    test('carries inline formats onto the new line', () => {
      const quill = createQuill(
        new Delta().insert('bold', { bold: true }).insert('\n'),
      );
      quill.setSelection(4, 0);
      pressEnter(quill);

      expect(quill.getFormat().bold).toBe(true);
    });

    test('carries an inline attributor onto the new line', () => {
      const quill = createQuill(
        new Delta().insert('big', { size: 'large' }).insert('\n'),
      );
      quill.setSelection(3, 0);
      pressEnter(quill);

      expect(quill.getFormat().size).toBe('large');
    });

    test('ends a link at the block break but keeps other inline formats', () => {
      const quill = createQuill(
        new Delta()
          .insert('link', { link: 'https://example.com', bold: true })
          .insert('\n'),
      );
      quill.setSelection(4, 0);
      pressEnter(quill);

      const formats = quill.getFormat();
      expect(formats.link).toBeUndefined();
      expect(formats.bold).toBe(true);
    });

    test('still carries block formats onto the new line', () => {
      const quill = createQuill(
        new Delta().insert('quoted').insert('\n', { blockquote: true }),
      );
      quill.setSelection(6, 0);
      pressEnter(quill);

      expect(quill.getFormat().blockquote).toBe(true);
    });

    // A header ends at the block break; only the line it was opened on stays a header.
    // The inline formats the user chose are not part of that and carry over.
    test('starts a plain paragraph after a header', () => {
      const quill = createQuill(
        new Delta().insert('heading').insert('\n', { header: 1 }),
      );
      quill.setSelection(7, 0);
      pressEnter(quill);

      expect(quill.getFormat().header).toBeUndefined();
    });

    test('keeps inline formats when a heading ends', () => {
      const quill = createQuill(
        new Delta()
          .insert('heading', { bold: true, font: 'serif' })
          .insert('\n', { header: 1 }),
      );
      quill.setSelection(7, 0);
      pressEnter(quill);

      expect(quill.getFormat()).toMatchObject({ bold: true, font: 'serif' });
      expect(quill.getFormat().header).toBeUndefined();
    });

    test('soft break keeps the surrounding inline formats', () => {
      const quill = createQuill(
        new Delta().insert('ab', { bold: true }).insert('\n'),
      );
      quill.setSelection(1, 0);
      pressEnter(quill, true);

      expect(quill.getContents().ops).toEqual([
        { insert: `a${SOFT_BREAK_CHARACTER}b`, attributes: { bold: true } },
        { insert: '\n' },
      ]);
    });

    test('text typed after a soft break keeps the inline formats', () => {
      const quill = createQuill(
        new Delta().insert('ab', { bold: true }).insert('\n'),
      );
      quill.setSelection(2, 0);
      pressEnter(quill, true);
      quill.insertText(
        assert(quill.getSelection()).index,
        'c',
        Quill.sources.USER,
      );

      expect(quill.getContents().ops).toEqual([
        { insert: `ab${SOFT_BREAK_CHARACTER}c`, attributes: { bold: true } },
        { insert: '\n' },
      ]);
    });

    // An attributor (size) plus an inline blot (bold) used to be applied to the caret one
    // at a time, re-running scroll.optimize() next to the new embed until Parchment gave up.
    test('soft break next to a size attributor does not break optimize', () => {
      const quill = createQuill(
        new Delta()
          .insert('abc', { size: 'huge', bold: true, color: '#e60000' })
          .insert('\n'),
      );
      quill.setSelection(3, 0);

      const errors = uncaughtDuring(() => {
        pressEnter(quill, true);
        pressEnter(quill, true);
      });

      expect(errors).toEqual([]);
      expect(quill.getFormat()).toMatchObject({
        size: 'huge',
        bold: true,
        color: '#e60000',
      });
    });

    test('soft break replaces the selected text', () => {
      const quill = createQuill(new Delta().insert('abcd').insert('\n'));
      quill.setSelection(1, 2);
      pressEnter(quill, true);

      expect(quill.getText()).toBe(`a${SOFT_BREAK_CHARACTER}d\n`);
    });

    describe('header autofill', () => {
      const typeSpaceAfter = (
        prefix: string,
        attrs: Record<string, unknown> = {},
      ) => {
        const quill = createQuill(
          new Delta().insert(prefix, attrs).insert('\n'),
        );
        quill.setSelection(prefix.length, 0);
        quill.root.dispatchEvent(createKeyboardEvent(' '));
        return quill;
      };

      for (const level of [1, 2, 3, 4, 5, 6]) {
        test(`"${'#'.repeat(level)} " becomes a level ${level} heading`, () => {
          const quill = typeSpaceAfter('#'.repeat(level));

          expect(quill.getFormat().header).toBe(level);
          expect(quill.getText()).toBe('\n');
        });
      }

      test('seven hashes stay literal text', () => {
        const quill = typeSpaceAfter('#######');

        // A synthetic keydown does not type the space, so only the absence of the
        // heading is meaningful here.
        expect(quill.getFormat().header).toBeUndefined();
        expect(quill.getText()).toBe('#######\n');
      });

      test('keeps inline formats the hashes carried', () => {
        const quill = typeSpaceAfter('##', { bold: true, font: 'serif' });

        expect(quill.getFormat()).toMatchObject({
          header: 2,
          bold: true,
          font: 'serif',
        });
      });

      test('does not fire inside an existing heading', () => {
        const quill = createQuill(
          new Delta().insert('text #').insert('\n', { header: 1 }),
        );
        quill.setSelection(6, 0);
        quill.root.dispatchEvent(createKeyboardEvent(' '));

        expect(quill.getFormat().header).toBe(1);
        expect(quill.getText()).toBe('text #\n');
      });

      test('does not fire mid-line', () => {
        const quill = createQuill(new Delta().insert('a #').insert('\n'));
        quill.setSelection(3, 0);
        quill.root.dispatchEvent(createKeyboardEvent(' '));

        expect(quill.getFormat().header).toBeUndefined();
        expect(quill.getText()).toBe('a #\n');
      });
    });

    // The prefix characters carry the line's inline formats, and autofill deletes them.
    describe('list autofill', () => {
      const typeSpaceAfter = (
        prefix: string,
        attrs: Record<string, unknown>,
      ) => {
        const quill = createQuill(
          new Delta().insert(prefix, attrs).insert('\n'),
        );
        quill.setSelection(prefix.length, 0);
        quill.root.dispatchEvent(createKeyboardEvent(' '));
        return quill;
      };

      test('keeps inline formats when "[]" becomes a checklist item', () => {
        const quill = typeSpaceAfter('[]', { bold: true, color: '#e60000' });

        expect(quill.getFormat()).toMatchObject({
          list: 'unchecked',
          bold: true,
          color: '#e60000',
        });
      });

      test('keeps inline formats when "-" becomes a bullet', () => {
        const quill = typeSpaceAfter('-', { bold: true });

        expect(quill.getFormat()).toMatchObject({
          list: 'bullet',
          bold: true,
        });
      });

      test('keeps a size attributor through autofill', () => {
        const quill = typeSpaceAfter('1.', { size: 'huge', bold: true });

        expect(quill.getFormat()).toMatchObject({
          list: 'ordered',
          size: 'huge',
          bold: true,
        });
      });
    });

    describe('checklist toggle', () => {
      const pressShortkeyEnter = (quill: Quill) => {
        quill.root.dispatchEvent(
          createKeyboardEvent('Enter', { [SHORTKEY]: true }),
        );
      };

      test('checks an unchecked item', () => {
        const quill = createQuill(
          new Delta().insert('task').insert('\n', { list: 'unchecked' }),
        );
        quill.setSelection(4, 0);
        pressShortkeyEnter(quill);

        expect(quill.getFormat().list).toBe('checked');
      });

      test('unchecks a checked item', () => {
        const quill = createQuill(
          new Delta().insert('task').insert('\n', { list: 'checked' }),
        );
        quill.setSelection(4, 0);
        pressShortkeyEnter(quill);

        expect(quill.getFormat().list).toBe('unchecked');
      });

      test('leaves a plain list item alone', () => {
        const quill = createQuill(
          new Delta().insert('item').insert('\n', { list: 'bullet' }),
        );
        quill.setSelection(4, 0);
        pressShortkeyEnter(quill);

        expect(quill.getFormat().list).toBe('bullet');
      });
    });
  });
});
