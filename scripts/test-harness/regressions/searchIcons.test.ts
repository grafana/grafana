import { getIconForKind } from '../../../public/app/features/search/service/icons';


it.each([
  { kind: 'dashboard', isOpen: undefined, expected: 'apps' },
  { kind: 'dashboard', isOpen: true, expected: 'apps' },
  { kind: 'folder', isOpen: undefined, expected: 'folder' },
  { kind: 'folder', isOpen: false, expected: 'folder' },
  { kind: 'folder', isOpen: true, expected: 'folder-open' },
  { kind: 'sharedwithme', isOpen: undefined, expected: 'users-alt' },
  { kind: 'unknown', isOpen: undefined, expected: 'question-circle' },
])('maps $kind with isOpen=$isOpen to $expected', ({ kind, isOpen, expected }) => {
  expect(getIconForKind(kind, isOpen)).toBe(expected);
});

