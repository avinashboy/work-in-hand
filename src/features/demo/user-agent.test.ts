import { describe, expect, it } from 'vitest'
import { describeUserAgent } from './user-agent'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1'
const ANDROID_PHONE =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36'
const ANDROID_TABLET =
  'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
const SAMSUNG =
  'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36'
const MAC_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15'
const WINDOWS_EDGE =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0'
const LINUX_FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0'
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/142.0.0.0 Mobile/15E148 Safari/604.1'

describe('describeUserAgent', () => {
  it('recognises an iPhone with Safari', () => {
    expect(describeUserAgent(IPHONE)).toEqual({
      device: 'iPhone',
      deviceType: 'Phone',
      os: 'iOS 18.2',
      browser: 'Safari 18.2',
    })
  })

  it('recognises Chrome on an iPhone', () => {
    expect(describeUserAgent(IPHONE_CHROME)).toMatchObject({ device: 'iPhone', browser: 'Chrome 142' })
  })

  it('recognises an Android phone', () => {
    expect(describeUserAgent(ANDROID_PHONE)).toEqual({
      device: 'Android phone',
      deviceType: 'Phone',
      os: 'Android 15',
      browser: 'Chrome 142',
    })
  })

  it('tells an Android tablet from a phone', () => {
    expect(describeUserAgent(ANDROID_TABLET)).toMatchObject({ device: 'Android tablet', deviceType: 'Tablet' })
  })

  it('names Samsung Internet rather than Chrome', () => {
    expect(describeUserAgent(SAMSUNG).browser).toBe('Samsung Internet 27')
  })

  it('recognises a Mac', () => {
    expect(describeUserAgent(MAC_SAFARI)).toEqual({
      device: 'Mac',
      deviceType: 'Desktop',
      os: 'macOS',
      browser: 'Safari 18.1',
    })
  })

  it('treats a "Mac" with a touch screen as an iPad', () => {
    expect(describeUserAgent(MAC_SAFARI, 5)).toMatchObject({ device: 'iPad', deviceType: 'Tablet' })
  })

  it('names Edge rather than Chrome on Windows', () => {
    expect(describeUserAgent(WINDOWS_EDGE)).toMatchObject({ device: 'Windows PC', browser: 'Edge 142' })
  })

  it('recognises Firefox on Linux', () => {
    expect(describeUserAgent(LINUX_FIREFOX)).toMatchObject({ os: 'Linux', browser: 'Firefox 144' })
  })

  it('says unknown when there is no user agent', () => {
    expect(describeUserAgent(null)).toEqual({
      device: 'Unknown',
      deviceType: 'Unknown',
      os: 'Unknown',
      browser: 'Unknown',
    })
  })

  it('says unknown for a user agent it does not recognise', () => {
    expect(describeUserAgent('curl/8.10.1')).toMatchObject({ device: 'Unknown', browser: 'Unknown' })
  })
})
