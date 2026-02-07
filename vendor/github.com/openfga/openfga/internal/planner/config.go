package planner

import "time"

type PlanConfig struct {
	Name string
	/*
		In Thompson Sampling, the algorithm models its belief about each strategy's performance as a probability distribution (a "belief curve").
		The InitialGuess is the value that the algorithm assumes is the most likely average latency for a strategy it knows nothing about.
		To choose a strategy, the algorithm doesn't just use the average; it takes a random sample (a "draw") from each strategy's full belief curve.
		Before any data is collected, these draws will be statistically centered around the InitialGuess.
		A strategy with a low InitialGuess will have its draws centered around a low number, making it more likely to be chosen initially.
		Once a strategy is chosen and its actual performance is measured, that new data point is used to update the belief curve via a Bayesian update.
		If a strategy with an InitialGuess of 50ms consistently performs at 10ms, the curve's center will quickly "move" from 50ms down to 10ms. This is how the algorithm learns and adapts.
	*/
	InitialGuess time.Duration
	/*
		Lambda represents our confidence in the InitialGuess. How many good runs do we believe we've effectively seen already?
		A low Lambda (e.g., 1) means we have very little confidence. The model is "open-minded" and will quickly change its beliefs based on the first few real results. This encourages exploration.
		A medium lambda: 5, means a modest trust.
		A high Lambda (e.g., 10) means we are very confident. The model is "stubborn" and will require a lot of contradictory data to move away from its initial guess. This encourages exploitation.
	*/
	Lambda float64
	/*
		Alpha and Beta work together to define our belief about the consistency (or variance) of the strategy's performance.
		They describe the shape of the curve, not just its center, like the initial guess.
		Alpha is related to the number of observations about consistency.
		Beta is related to the amount of variation seen in those observations.

		Higher α (for the same β) → higher expected precision → lower variance. For example, α = 20, β = 2 create a tall, narrow distribution.
		This means we are very confident that the performance will be extremely consistent and tightly clustered around the average.
		Low Alpha and Beta values (e.g., α ≤ 1,α = 0.5) create a wide, flat distribution. This means we are very uncertain and expect performance to be highly variable, and this causes more exploration.

		Higher β (for the same α) → lower precision → higher variance.
		If we expect the strategy to have bursty behaviour, keep α small (2–3) and/or β larger.
		If we expect the strategy to have tight behaviour, push α up and/or β down.
		If we don't have an idea, α≤1 keeps you very agnostic (heavy-tailed).
	*/

	Alpha float64
	Beta  float64
}
