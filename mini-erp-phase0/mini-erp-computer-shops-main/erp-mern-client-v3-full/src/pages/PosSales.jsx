import React from 'react'
import { PosLayout } from '../components/pos/PosLayout'

/**
 * PosSales - Main POS Page (V3 Refactored)
 * 
 * Previously 2000+ lines of monolithic code.
 * Now a clean, simple container delegating to PosLayout.
 * 
 * Architecture:
 * - Business logic → usePos hook
 * - UI components → components/pos/*
 * - Design tokens → lib/posDesignTokens.js
 * - Constants → constants/posConstants.js
 */
export default function PosSales() {
  return <PosLayout />
}