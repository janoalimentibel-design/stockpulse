import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { isInternational, getCurrency, getFxTicker, SUFFIX_CURRENCY } from '../lib/market.js'

describe('isInternational', () => {
  test('returns true for known exchange suffixes', () => {
    assert.equal(isInternational('ASML.AS'), true)
    assert.equal(isInternational('SAP.DE'), true)
    assert.equal(isInternational('LVMH.PA'), true)
    assert.equal(isInternational('AZN.L'), true)
    assert.equal(isInternational('7203.T'), true)
    assert.equal(isInternational('VOW3.DE'), true)
  })
  test('returns false for US tickers', () => {
    assert.equal(isInternational('AAPL'), false)
    assert.equal(isInternational('META'), false)
    assert.equal(isInternational('MELI'), false)
  })
  test('returns false for null/empty', () => {
    assert.equal(isInternational(null), false)
    assert.equal(isInternational(''), false)
  })
  test('returns false for unknown suffix', () => {
    assert.equal(isInternational('ABC.XY'), false)
  })
})

describe('getCurrency', () => {
  test('returns EUR for eurozone tickers', () => {
    assert.equal(getCurrency('ASML.AS'), 'EUR')
    assert.equal(getCurrency('SAP.DE'), 'EUR')
    assert.equal(getCurrency('LVMH.PA'), 'EUR')
    assert.equal(getCurrency('ENI.MI'), 'EUR')
    assert.equal(getCurrency('ITX.MC'), 'EUR')
  })
  test('returns GBP for London tickers', () => {
    assert.equal(getCurrency('AZN.L'), 'GBP')
  })
  test('returns JPY for Tokyo tickers', () => {
    assert.equal(getCurrency('7203.T'), 'JPY')
  })
  test('returns SEK for Stockholm tickers', () => {
    assert.equal(getCurrency('VOLV-B.ST'), 'SEK')
  })
  test('returns USD for US tickers and null', () => {
    assert.equal(getCurrency('AAPL'), 'USD')
    assert.equal(getCurrency(null), 'USD')
  })
})

describe('getFxTicker', () => {
  test('returns Yahoo FX ticker format', () => {
    assert.equal(getFxTicker('EUR'), 'EURUSD=X')
    assert.equal(getFxTicker('GBP'), 'GBPUSD=X')
    assert.equal(getFxTicker('JPY'), 'JPYUSD=X')
    assert.equal(getFxTicker('SEK'), 'SEKUSD=X')
  })
  test('returns null for USD and null input', () => {
    assert.equal(getFxTicker('USD'), null)
    assert.equal(getFxTicker(null), null)
  })
})

describe('SUFFIX_CURRENCY', () => {
  test('covers all 17 exchanges from spec', () => {
    const expected = ['.AS','.DE','.PA','.L','.MI','.MC','.ST','.HE','.CO','.OL','.VI','.SW','.BR','.LS','.IR','.AT','.T']
    expected.forEach(s => assert.notEqual(SUFFIX_CURRENCY[s], undefined, `Missing suffix: ${s}`))
  })
})
