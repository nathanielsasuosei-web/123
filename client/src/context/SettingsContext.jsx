import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api } from '../api'

const SettingsContext = createContext(null)

const FALLBACK = {
  siteName: 'MiraKilousE Beats',
  producerName: 'MiraKilousE',
  currencyCode: 'GHS',
  currencySymbol: '₵',
  momoProvider: 'MTN Mobile Money',
  momoNumber: '',
  bankName: '',
  bankAccountName: '',
  bankAccountNumber: '',
  contactEmail: '',
  licenseTerms: '',
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(FALLBACK)

  const refresh = useCallback(async () => {
    try {
      const { settings } = await api('/api/settings/public')
      setSettings({ ...FALLBACK, ...settings })
    } catch {
      /* keep fallback */
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return <SettingsContext.Provider value={{ settings, refresh }}>{children}</SettingsContext.Provider>
}

export const useSettings = () => useContext(SettingsContext)
