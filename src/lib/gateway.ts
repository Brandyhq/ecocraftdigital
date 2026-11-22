import type { Bindings } from '../env'

export type GatewayCapabilities = {
  /** Wallet and instant-pay buttons the gateway can serve. The storefront also checks the device (Apple Pay). */
  quickPay: { bit: boolean; applePay: boolean; googlePay: boolean }
  /** The gateway offers a card form that can be embedded in the checkout page. */
  embeddedCard: boolean
}

/**
 * Part of the adapter in ECOMMERCE_SPEC.md, section 6. Stage 3 only needs what the checkout UI uses;
 * verifyWebhook, confirmTransaction and refund join in stage 5 with the real gateway.
 */
export interface PaymentGateway {
  name: string
  capabilities: GatewayCapabilities
  createPayment(order: { id: number; totalAgorot: number }, method: string, origin: string): Promise<{ embedUrl: string; gatewayRef: string }>
}

const MOCK_METHODS = ['card', 'bit', 'applePay', 'googlePay']

/** Test double: serves a fake card form that can succeed, fail or hold for a few seconds. Never charges anything. */
const mockGateway: PaymentGateway = {
  name: 'mock',
  capabilities: { quickPay: { bit: true, applePay: true, googlePay: true }, embeddedCard: true },
  async createPayment(order, method, origin) {
    const m = MOCK_METHODS.includes(method) ? method : 'card'
    return { embedUrl: `${origin}/mock-pay/${order.id}?m=${m}`, gatewayRef: `mock-${order.id}` }
  }
}

/**
 * The mock exists only where PAYMENT_GATEWAY=mock is set (local development). Production never sets it:
 * the mock marks orders as paid without any payment. Without a gateway the checkout keeps the manual flow.
 */
export function getGateway(env: Bindings): PaymentGateway | null {
  return env.PAYMENT_GATEWAY === 'mock' ? mockGateway : null
}
