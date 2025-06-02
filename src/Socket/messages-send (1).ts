
import NodeCache from '@cacheable/node-cache'
import { Boom } from '@hapi/boom'
import { randomBytes } from 'crypto'
import { proto } from '../../WAProto'
import { DEFAULT_CACHE_TTLS } from '../Defaults'
import {
	unixTimestampSeconds,
	encodeWAMessage,
	generateMessageID,
	normalizeMessageContent,
	getUrlFromDirectPath,
	getWAUploadToServer,
	bindWaitForEvent
} from '../Utils'
import {
	isJidUser,
	isJidGroup,
	isJidNewsletter,
	getBinaryFilteredButtons,
	jidEncode
} from '../WABinary'
import { makeNewsletterSocket } from './newsletter'
import { getUrlInfo } from '../Utils/link-preview'
import { MessageRelayOptions, SocketConfig } from '../Types'

// --- Button Helper Functions ---
function getButtonType(message: any): string | undefined {
	if (message.listMessage) return 'list'
	if (message.buttonsMessage) return 'buttons'
	if (message.templateMessage) return 'template'
	if (message.interactiveMessage?.nativeFlowMessage) return 'native_flow'
}

function getButtonArgs(message: any): any {
	if (
		message.interactiveMessage?.nativeFlowMessage &&
		message.interactiveMessage.nativeFlowMessage?.buttons?.[0]?.name === 'review_and_pay'
	) {
		return {
			tag: 'biz',
			attrs: { native_flow_name: 'order_details' }
		}
	} else if (message.interactiveMessage?.nativeFlowMessage || message.buttonsMessage) {
		return {
			tag: 'biz',
			attrs: {},
			content: [
				{
					tag: 'interactive',
					attrs: { type: 'native_flow', v: '1' },
					content: [
						{
							tag: 'native_flow',
							attrs: { name: 'quick_reply' }
						}
					]
				}
			]
		}
	} else if (message.listMessage) {
		return {
			tag: 'biz',
			attrs: {},
			content: [
				{
					tag: 'list',
					attrs: { type: 'product_list', v: '2' }
				}
			]
		}
	} else if (message.templateMessage) {
		return {
			tag: 'biz',
			attrs: {},
			content: [
				{
					tag: 'hsm',
					attrs: {
						tag: 'AUTHENTICATION',
						category: ''
					}
				}
			]
		}
	}
	return undefined
}

// --- relayMessage Example with Buttons Integrated ---
async function relayMessage(
	jid: string,
	message: proto.IMessage,
	options: MessageRelayOptions
): Promise<string> {
	const normalized = normalizeMessageContent(message)
	const buttonType = getButtonType(normalized)

	const stanza: any = {
		tag: 'message',
		attrs: {
			id: generateMessageID('bot'),
			to: jid,
			type: 'text'
		},
		content: []
	}

	if (buttonType) {
		const buttonsNode = getButtonArgs(normalized)
		if (!getBinaryFilteredButtons(options.additionalNodes || [])) {
			stanza.content.push(buttonsNode)
		}
	}

	// Simulate sending node (normally you'd call sendNode or equivalent)
	console.log(`Sending message to ${jid} with ID ${stanza.attrs.id}`)
	return stanza.attrs.id
}

// --- Socket Factory ---
export function makeMessagesSocket(config: SocketConfig) {
	const sock = makeNewsletterSocket(config)

	return {
		...sock,
		relayMessage // Overridden with button logic support
	}
}
