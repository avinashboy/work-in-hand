import { describe, expect, it } from 'vitest'
import { pageAfterResize, pagerItems, shownRange } from './history-pager'

describe('pagerItems', () => {
  it('shows every page when there are only a few', () => {
    expect(pagerItems(1, 1)).toEqual([1])
    expect(pagerItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('keeps the first, last and nearby pages, with gaps between', () => {
    expect(pagerItems(10, 20)).toEqual([1, 'gap', 9, 10, 11, 'gap', 20])
  })

  it('fills in near the start and the end instead of a gap', () => {
    expect(pagerItems(1, 20)).toEqual([1, 2, 3, 4, 5, 'gap', 20])
    expect(pagerItems(4, 20)).toEqual([1, 2, 3, 4, 5, 'gap', 20])
    expect(pagerItems(20, 20)).toEqual([1, 'gap', 16, 17, 18, 19, 20])
  })

  it('always gives the same number of slots, so the pager does not jump', () => {
    for (let page = 1; page <= 20; page += 1) {
      expect(pagerItems(page, 20)).toHaveLength(7)
    }
  })
})

describe('pageAfterResize', () => {
  it('keeps the first card on screen when the page size changes', () => {
    // Page 3 of 20 starts at card 41: with 50 a page that's page 1, with 30 it's page 2.
    expect(pageAfterResize(3, 20, 50)).toBe(1)
    expect(pageAfterResize(3, 20, 30)).toBe(2)
    expect(pageAfterResize(2, 50, 20)).toBe(3)
    expect(pageAfterResize(1, 20, 40)).toBe(1)
  })
})

describe('shownRange', () => {
  it('says which cards this page holds', () => {
    expect(shownRange(1, 55, 20)).toEqual({ first: 1, last: 20 })
    expect(shownRange(3, 55, 20)).toEqual({ first: 41, last: 55 })
  })

  it('is empty with no cards', () => {
    expect(shownRange(1, 0, 20)).toEqual({ first: 0, last: 0 })
  })
})
