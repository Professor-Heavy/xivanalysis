import {t} from '@lingui/macro'
import TransMarkdown from 'components/ui/TransMarkdown'
import CONTRIBUTORS, {ROLES} from 'data/CONTRIBUTORS'
import {Meta} from 'parser/core/Meta'
import React from 'react'

const description = t('gnb.about.description')`This analyzer looks for the low-hanging, easy to spot issues in your gameplay that can be fixed to improve your damage across a fight as Gunbreaker.
If you're looking to learn about how exactly the job plays and functions from the ground up, take a look at a few basic guides:

* [General tanking guide by Aletin](https://goo.gl/nYzAnq)
* [No Mercy Windows by Rin Karigani](https://i.imgur.com/o8hza9e.png)

If you have any suggestions about the module, feel free to join the XIVA discord and use the feedback channels.
`

export const GUNBREAKER = new Meta({
	modules: () => import('./modules' /* webpackChunkName: "jobs-gnb" */),

	Description: () => <TransMarkdown source={description}/>,

	// supportedPatches: {
	// 	from: '6.0',
	// 	to: '6.0',
	// },

	contributors: [
		{user: CONTRIBUTORS.RYAN, role: ROLES.DEVELOPER},
		{user: CONTRIBUTORS.JONNIX, role: ROLES.DEVELOPER},
		{user: CONTRIBUTORS.EDEN, role: ROLES.DEVELOPER},
	],

	changelog: [
		// {
		// 	date: new Date('2020-04-20'),
		// 	Changes: () => <>The changes you made</>,
		// 	contrubutors: [CONTRIBUTORS.YOU],
		// },
		{
			date: new Date('2021-12-11'),
			Changes: () => <>
				<ul>
					<li>GNB updated to include 6.0 Actions/Statues on timeline.</li>
					<li>Cooldown adjusted to include Double Down / New Opener.</li>
				</ul>,
			</>,
			contributors: [CONTRIBUTORS.RYAN],
		},
		{
			date: new Date('2021-12-19'),
			Changes: () => <>
				<ul>
					<li>Added cartridge usage for Double Down to Ammo module</li>
				</ul>,
			</>,
			contributors: [CONTRIBUTORS.JONNIX],
		},
		{
			date: new Date('2021-12-19'),
			Changes: () => <>
				<ul>
					<li>Fix Lightning Shot breaking combo</li>
				</ul>,
			</>,
			contributors: [CONTRIBUTORS.RYAN],
		},
		{
			date: new Date('2021-12-21'),
			Changes: () => <>
				<ul>
					<li>Reorder Heart of Corundum in Timeline together with other party mitigations.</li>
				</ul>
			</>,
			contributors: [CONTRIBUTORS.EDEN],
		},
		{
			date: new Date('2021-12-28'),
			Changes: () => <>
				<ul>
					<li>Add Double Down to No Mercy window, and update Blast Shot GCD counts</li>
				</ul>,
			</>,
			contributors: [CONTRIBUTORS.JONNIX],
		},
	],
})
