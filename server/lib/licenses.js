/** License options. Prices live on each beat (in pesewas). */
export const LICENSES = {
  mp3: {
    label: 'MP3 Lease',
    priceField: 'price_mp3',
    format: 'MP3',
    terms:
      'Non-exclusive lease. Use the beat in up to 1 song (or project) for release. ' +
      'Up to 5,000 audio streams and 1 music video. Credit "Prod. by" required. ' +
      'The beat stays available for other buyers.',
  },
  wav: {
    label: 'WAV Lease',
    priceField: 'price_wav',
    format: 'WAV',
    terms:
      'Non-exclusive lease with lossless WAV. Use the beat in up to 1 song (or project) for release. ' +
      'Up to 50,000 audio streams and 2 music videos. Credit "Prod. by" required. ' +
      'The beat stays available for other buyers.',
  },
  exclusive: {
    label: 'Exclusive Rights',
    priceField: 'price_exclusive',
    format: 'WAV',
    terms:
      'Exclusive rights. The beat is removed from the store after purchase and will not be sold again. ' +
      'Unlimited streams, sales and videos. Credit "Prod. by" appreciated but not required. ' +
      'The buyer receives the WAV file.',
  },
};

export const LICENSE_KEYS = Object.keys(LICENSES);
