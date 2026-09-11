import { describe, it, expect } from 'vitest';
import {
  handleTreeItemClick,
  handleTreeArrowNavigation,
  handleTreeSelectAll,
  getStudyCheckState,
  TreeItem,
  HierarchicalSelectionState,
} from '../utils/selectionHelper';

describe('Hierarchical Selection Helper (Study and Series levels)', () => {
  // Mock hierarchy:
  // Study 1 -> Series 1A, Series 1B, Series 1C
  // Study 2 -> Series 2A, Series 2B
  const treeItems: TreeItem[] = [
    {
      id: 'study:std-1',
      type: 'study',
      studyUid: 'std-1',
      seriesUids: ['ser-1A', 'ser-1B', 'ser-1C'],
    },
    {
      id: 'series:ser-1A',
      type: 'series',
      studyUid: 'std-1',
      seriesUid: 'ser-1A',
      seriesUids: ['ser-1A'],
    },
    {
      id: 'series:ser-1B',
      type: 'series',
      studyUid: 'std-1',
      seriesUid: 'ser-1B',
      seriesUids: ['ser-1B'],
    },
    {
      id: 'series:ser-1C',
      type: 'series',
      studyUid: 'std-1',
      seriesUid: 'ser-1C',
      seriesUids: ['ser-1C'],
    },
    {
      id: 'study:std-2',
      type: 'study',
      studyUid: 'std-2',
      seriesUids: ['ser-2A', 'ser-2B'],
    },
    {
      id: 'series:ser-2A',
      type: 'series',
      studyUid: 'std-2',
      seriesUid: 'ser-2A',
      seriesUids: ['ser-2A'],
    },
    {
      id: 'series:ser-2B',
      type: 'series',
      studyUid: 'std-2',
      seriesUid: 'ser-2B',
      seriesUids: ['ser-2B'],
    },
  ];

  it('calculates getStudyCheckState correctly (checked, indeterminate, unchecked)', () => {
    const studySeries = ['ser-1A', 'ser-1B', 'ser-1C'];

    expect(getStudyCheckState(studySeries, new Set(['ser-1A', 'ser-1B', 'ser-1C']))).toBe('checked');
    expect(getStudyCheckState(studySeries, new Set(['ser-1A', 'ser-1C']))).toBe('indeterminate');
    expect(getStudyCheckState(studySeries, new Set(['ser-2A']))).toBe('unchecked');
    expect(getStudyCheckState(studySeries, new Set())).toBe('unchecked');
  });

  it('selecting a study selects all of its series', () => {
    const initialState: HierarchicalSelectionState = {
      selectedSeriesUids: new Set(['ser-2A']),
      anchorItemId: 'series:ser-2A',
      activeItemId: 'series:ser-2A',
    };

    const next = handleTreeItemClick(treeItems, treeItems[0], initialState, {
      isCtrlOrCmd: false,
      isShift: false,
    });

    expect(Array.from(next.selectedSeriesUids).sort()).toEqual(['ser-1A', 'ser-1B', 'ser-1C'].sort());
    expect(getStudyCheckState(treeItems[0].seriesUids, next.selectedSeriesUids)).toBe('checked');
  });

  it('Cmd+clicking a series inside a fully selected study drops the study to indeterminate', () => {
    // Start with Study 1 fully selected
    const stateWithStudy1Selected: HierarchicalSelectionState = {
      selectedSeriesUids: new Set(['ser-1A', 'ser-1B', 'ser-1C']),
      anchorItemId: 'study:std-1',
      activeItemId: 'study:std-1',
    };
    expect(getStudyCheckState(treeItems[0].seriesUids, stateWithStudy1Selected.selectedSeriesUids)).toBe('checked');

    // User Cmd+clicks series 1B to unselect it
    const afterDeselectingSeries1B = handleTreeItemClick(
      treeItems,
      treeItems[2], // series:ser-1B
      stateWithStudy1Selected,
      { isCtrlOrCmd: true, isShift: false }
    );

    expect(Array.from(afterDeselectingSeries1B.selectedSeriesUids).sort()).toEqual(['ser-1A', 'ser-1C'].sort());
    // Study 1 is now indeterminate (not fully checked anymore!)
    expect(getStudyCheckState(treeItems[0].seriesUids, afterDeselectingSeries1B.selectedSeriesUids)).toBe('indeterminate');
  });

  it('allows selecting 2 series from Study 1 and 2 series from Study 2', () => {
    // Single click selects Series 1A
    let state = handleTreeItemClick(treeItems, treeItems[1], {
      selectedSeriesUids: new Set(),
      anchorItemId: null,
      activeItemId: null,
    }, { isCtrlOrCmd: false, isShift: false });

    // Cmd+click Series 1B
    state = handleTreeItemClick(treeItems, treeItems[2], state, { isCtrlOrCmd: true, isShift: false });

    // Cmd+click Series 2A
    state = handleTreeItemClick(treeItems, treeItems[5], state, { isCtrlOrCmd: true, isShift: false });

    // Cmd+click Series 2B
    state = handleTreeItemClick(treeItems, treeItems[6], state, { isCtrlOrCmd: true, isShift: false });

    expect(Array.from(state.selectedSeriesUids).sort()).toEqual(['ser-1A', 'ser-1B', 'ser-2A', 'ser-2B'].sort());
    expect(getStudyCheckState(treeItems[0].seriesUids, state.selectedSeriesUids)).toBe('indeterminate');
    expect(getStudyCheckState(treeItems[4].seriesUids, state.selectedSeriesUids)).toBe('checked');
  });

  it('handles Shift+click range selection across studies and series', () => {
    const initialState: HierarchicalSelectionState = {
      selectedSeriesUids: new Set(['ser-1B']),
      anchorItemId: 'series:ser-1B',
      activeItemId: 'series:ser-1B',
    };

    // Shift+click to Series 2A
    const next = handleTreeItemClick(treeItems, treeItems[5], initialState, {
      isCtrlOrCmd: false,
      isShift: true,
    });

    // Should include series 1B, series 1C, study 2 (series 2A, 2B), and series 2A
    expect(Array.from(next.selectedSeriesUids).sort()).toEqual(['ser-1B', 'ser-1C', 'ser-2A', 'ser-2B'].sort());
    expect(next.anchorItemId).toBe('series:ser-1B');
    expect(next.activeItemId).toBe('series:ser-2A');
  });

  it('handles arrow navigation and Shift+arrow range extension', () => {
    const initialState: HierarchicalSelectionState = {
      selectedSeriesUids: new Set(['ser-1A']),
      anchorItemId: 'series:ser-1A',
      activeItemId: 'series:ser-1A',
    };

    // Down to ser-1B
    const down = handleTreeArrowNavigation(treeItems, 'down', initialState, false);
    expect(Array.from(down.selectedSeriesUids)).toEqual(['ser-1B']);
    expect(down.activeItemId).toBe('series:ser-1B');

    // Shift+down to ser-1C
    const shiftDown = handleTreeArrowNavigation(treeItems, 'down', down, true);
    expect(Array.from(shiftDown.selectedSeriesUids).sort()).toEqual(['ser-1B', 'ser-1C'].sort());
  });

  it('handles Select All across all series', () => {
    const allSeries = ['ser-1A', 'ser-1B', 'ser-1C', 'ser-2A', 'ser-2B'];
    const all = handleTreeSelectAll(treeItems, allSeries, {
      selectedSeriesUids: new Set(['ser-1A']),
      anchorItemId: null,
      activeItemId: null,
    });

    expect(all.selectedSeriesUids.size).toBe(5);
    expect(Array.from(all.selectedSeriesUids).sort()).toEqual(allSeries.sort());
  });
});
