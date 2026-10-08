/**
 * Loads server/.env into process.env. This module MUST be the first import of
 * any server entrypoint — ESM evaluates imports in order, and other modules
 * (e.g. auth.js) read process.env at module-evaluation time.
 */
import dotenv from 'dotenv'

dotenv.config({ path: new URL('../.env', import.meta.url) })
