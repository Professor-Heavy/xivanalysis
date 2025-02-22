import {t} from '@lingui/macro'
import {Trans} from '@lingui/react'
import {ActionLink, StatusLink} from 'components/ui/DbLink'
import {RotationTargetOutcome} from 'components/ui/RotationTable'
import {ActionKey} from 'data/ACTIONS'
import {Event, Events} from 'event'
import _ from 'lodash'
import {filter} from 'parser/core/filter'
import {dependency} from 'parser/core/Injectable'
import {BuffWindow, EvaluatedAction, ExpectedActionsEvaluator, ExpectedGcdCountEvaluator, TrackedAction, TrackedActionsOptions} from 'parser/core/modules/ActionWindow'
import {HistoryEntry} from 'parser/core/modules/ActionWindow/History'
import {Actors} from 'parser/core/modules/Actors'
import {GlobalCooldown} from 'parser/core/modules/GlobalCooldown'
import {SEVERITY} from 'parser/core/modules/Suggestions'
import React from 'react'
import {Team} from 'report'
import {isDefined} from 'utilities'
import DISPLAY_ORDER from './DISPLAY_ORDER'

// Minimum muse GCDs needed to expect an RS window to have 9 GCDs
const MIN_MUSE_GCDS = 3

const SUPPORT_ACTIONS: ActionKey[] = [
	'ARMS_LENGTH',
	'FOOT_GRAZE',
	'HEAD_GRAZE',
	'LEG_GRAZE',
	'NATURES_MINNE',
	'PELOTON',
	'REPELLING_SHOT',
	'SECOND_WIND',
	'SPRINT',
	'THE_WARDENS_PAEAN',
	'TROUBADOUR',
]

interface MuseWindow {
	start: number,
	end?: number | undefined,
}

interface BarrageOptions extends TrackedActionsOptions {
	barrageId: number
	wasBarrageUsed: (window: HistoryEntry<EvaluatedAction[]>) => boolean
}
class BarrageEvaluator extends ExpectedActionsEvaluator {
	// Because this class is not an Analyser, it cannot use Data directly
	// to get the id for Barrage, so it has to take it in here.
	private barrageId: number
	private wasBarrageUsed: (window: HistoryEntry<EvaluatedAction[]>) => boolean

	constructor(opts: BarrageOptions) {
		super(opts)
		this.barrageId = opts.barrageId
		this.wasBarrageUsed = opts.wasBarrageUsed
	}

	override countUsed(window: HistoryEntry<EvaluatedAction[]>, action: TrackedAction) {
		if (action.action.id === this.barrageId) {
			return this.wasBarrageUsed(window) ? 1 : 0
		}
		return super.countUsed(window, action)
	}
}

export class RagingStrikes extends BuffWindow {
	static override handle = 'rs'
	static override title = t('brd.rs.title')`Raging Strikes`
	static override displayOrder = DISPLAY_ORDER.RAGING_STRIKES

	@dependency private globalCooldown!: GlobalCooldown
	@dependency private actors!: Actors

	override buffStatus = this.data.statuses.RAGING_STRIKES

	private museHistory: MuseWindow[] = []
	private barrageRemoves: number[] = []

	override initialise() {
		super.initialise()

		this.ignoreActions(SUPPORT_ACTIONS.map(actionKey => this.data.actions[actionKey].id))

		const playerFilter = filter<Event>().source(this.parser.actor.id)
		const buffFilter = playerFilter.status(this.data.statuses.ARMYS_MUSE.id)
		this.addEventHook(buffFilter.type('statusApply'), this.onApplyMuse)
		this.addEventHook(buffFilter.type('statusRemove'), this.onRemoveMuse)
		this.addEventHook(playerFilter.status(this.data.statuses.BARRAGE.id).type('statusRemove'), this.onRemoveBarrage)

		const suggestionWindowName = <ActionLink action="RAGING_STRIKES" showIcon={false} />
		this.addEvaluator(new ExpectedGcdCountEvaluator({
			expectedGcds: 8,
			globalCooldown: this.globalCooldown,
			suggestionIcon: this.data.actions.RAGING_STRIKES.icon,
			suggestionContent: <Trans id="brd.rs.suggestions.missedgcd.content">
				Try to land 8 GCDs (9 GCDs with <StatusLink {...this.data.statuses.ARMYS_MUSE}/>) during every <ActionLink {...this.data.actions.RAGING_STRIKES}/> window.
			</Trans>,
			suggestionWindowName,
			severityTiers: {
				1: SEVERITY.MINOR,
				3: SEVERITY.MEDIUM,
				5: SEVERITY.MAJOR,
			},
			adjustCount: this.adjustExpectedGcdCount.bind(this),
		}))

		this.addEvaluator(new BarrageEvaluator({
			expectedActions: [
				{
					action: this.data.actions.BARRAGE,
					expectedPerWindow: 1,
				},
				{
					action: this.data.actions.IRON_JAWS,
					expectedPerWindow: 1,
				},
			],
			suggestionIcon: this.data.actions.BARRAGE.icon,
			suggestionContent: <Trans id="brd.rs.suggestions.trackedactions.content">
				One use of <ActionLink {...this.data.actions.BARRAGE}/> and one use of <ActionLink {...this.data.actions.IRON_JAWS}/> should occur during every <ActionLink {...this.data.actions.RAGING_STRIKES}/> window.
			</Trans>,
			suggestionWindowName,
			severityTiers: {
				1: SEVERITY.MINOR,
				3: SEVERITY.MEDIUM,
				5: SEVERITY.MAJOR,
			},
			adjustCount: this.adjustExpectedActionCount.bind(this),
			adjustOutcome: this.adjustExpectedActionOutcome.bind(this),
			barrageId: this.data.actions.BARRAGE.id,
			wasBarrageUsed: this.wasBarrageUsed.bind(this),
		}))
	}

	private get activeMuse(): MuseWindow | undefined {
		const last = _.last(this.museHistory)
		if (last && !isDefined(last.end)) {
			return last
		}
		return undefined
	}

	private onApplyMuse(event: Events['statusApply']) {
		this.museHistory.push({start: event.timestamp})
	}

	private onRemoveMuse(event: Events['statusRemove']) {
		if (this.activeMuse) {
			this.activeMuse.end = event.timestamp
		}
	}

	private onRemoveBarrage(event: Events['statusRemove']) {
		this.barrageRemoves.push(event.timestamp)
	}

	private adjustExpectedGcdCount(window: HistoryEntry<EvaluatedAction[]>) {
		// Check if muse was up for at least 3 GCDs in this buffWindow
		const museOverlap = this.museHistory.some(muse => (
			window.data.filter(event => this.data.getAction(event.action.id)?.onGcd &&
					event.timestamp > muse.start && (!muse.end || event.timestamp < muse.end))
				.length >= MIN_MUSE_GCDS
		))

		return museOverlap ? 1 : 0
	}

	private adjustExpectedActionCount(window: HistoryEntry<EvaluatedAction[]>, action: TrackedAction) {
		/**
		 * IJ definitely shouldn't be used at the end of the fight, so reduce by 1
		 * Barrage might have floated to the end of the RS window, so reduce by 1
		 */
		if (this.isRushedEndOfPullWindow(window)) {
			return -1
		}

		// If the action was Iron Jaws, the upper limit = the number of enemies we cast something on during this RS window
		if (action.action !== this.data.actions.IRON_JAWS) {
			return 0
		}

		const enemyIDs = new Set<string>()
		window.data
			.filter(e => this.actors.get(e.target).team === Team.FOE)
			.forEach(e => enemyIDs.add(e.target))

		// Baseline number of allowed Iron Jaws is 1 and this function is an adjustment.
		return Math.max(enemyIDs.size - 1, 0)
	}

	private adjustExpectedActionOutcome(window: HistoryEntry<EvaluatedAction[]>, action: TrackedAction) {
		/**
		 * Positive only if we had exactly one Iron Jaws in this RS
		 * If expected > 1, we're in AoE and there is no clear rotation target, so don't highlight this cell
		 */
		if (action.action === this.data.actions.IRON_JAWS) {
			return (actual: number, expected?: number) => {
				if (!isDefined(expected) || expected > 1) {
					return RotationTargetOutcome.NEUTRAL
				}

				if (actual === expected) {
					return RotationTargetOutcome.POSITIVE
				}

				return RotationTargetOutcome.NEGATIVE
			}
		}
	}

	private wasBarrageUsed(window: HistoryEntry<EvaluatedAction[]>) {
		const gcdTimestamps = window.data
			.filter(event => event.action.onGcd)
			.map(event => event.timestamp)
		if (gcdTimestamps.length === 0) { return false }

		// Check to make sure at least one GCD happened before the status expired
		const firstGcd = gcdTimestamps[0]
		return this.barrageRemoves.some(timestamp => firstGcd <= timestamp && timestamp <= (window.end ?? window.start))
	}
}
