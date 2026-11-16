# Visual Dice Teaching Standard

Nothing But a Dice Roller should become the beginner-facing dice laboratory for Ember & Stone.

## Core teaching model

Teach dice in this order:

### 1. The d20 is the base resolution die

Begin with the simplest mental model:

> **The d20 is the die you usually roll when your character is trying to do something, or when something is happening to your character and the game needs to know whether you resist or avoid it.**

Examples:
- attack roll;
- ability check;
- skill check;
- saving throw;
- death save.

The exact rule varies by situation, but the beginner should first understand:

> **d20 = did I succeed?**

Then explain the usual structure:

```
d20 + modifier vs target number
```

Target number may be:
- Armor Class;
- Difficulty Class;
- saving throw DC;
- another rules-defined threshold.

### 2. The other dice usually measure effect

Beginner mental model:

> **The other dice usually tell us how much happens after the d20 tells us whether it happens.**

Common examples:
- weapon damage;
- spell damage;
- healing;
- Hit Dice;
- temporary/random effect values;
- some class features and monster abilities.

Do not claim every non-d20 die is always damage. Explain that damage is the easiest first example.

### 3. Die size communicates scale

Use intuitive physical examples:

> A dagger is a small weapon, so its damage die is small: **d4**.

> A much larger two-handed sword can roll **2d6**, so its potential damage is generally larger.

Then introduce:
- d4 = 1–4;
- d6 = 1–6;
- d8 = 1–8;
- d10 = 1–10;
- d12 = 1–12.

Explain that more dice can also increase the possible result:
- 1d6;
- 2d6;
- 3d6;
- etc.

Avoid implying bigger physical weapons always map directly to bigger single dice; teach this as an intuition aid, then show the actual weapon rule.

## Visual rolling

The website should show the actual die or dice rolling whenever practical.

A learner should see:

1. the physical die shape;
2. the die name;
3. the numbers on it;
4. the roll animation;
5. the face/result it lands on;
6. the modifier being added;
7. the final total;
8. what that total is compared against;
9. the success/failure outcome.

Example:

```
Attack Roll

[d20 visibly rolls]

14
+ 5 attack bonus
= 19

Target AC: 16

HIT
```

Then:

```
Damage

[d8 visibly rolls]

6
+ 3 Strength
= 9 slashing damage
```

The user should visually understand that:
- the d20 determined whether the attack hit;
- the d8 determined how much weapon damage happened.

## Dice identification mode

Provide a beginner mode that teaches die names visually.

Show:
- d4;
- d6;
- d8;
- d10;
- d12;
- d20;
- d100 / percentile.

Each should have:
- 3D or clear 2D representation;
- number of sides;
- spoken/plain-language name;
- common uses.

Examples:

**d4**
> Four-sided die. Often used for smaller damage/healing values.

**d6**
> Six-sided die. The familiar cube. Used for many weapons, spells, healing effects, and Hit Dice.

**d20**
> Twenty-sided die. The main success/failure die in D&D.

## Terminology teaching

Whenever notation appears, decode it.

Examples:

**1d8**
> Roll one eight-sided die.

**2d6**
> Roll two six-sided dice and add them together.

**1d20 + 5**
> Roll one twenty-sided die, then add 5.

**4d6 drop lowest**
> Roll four six-sided dice, ignore the lowest result, then add the remaining three.

Never assume a beginner knows dice notation.

## Dice notation translator

Include an interactive field:

> What does this mean?

Input:
```
2d6 + 3
```

Output:
> Roll two six-sided dice, add both results together, then add 3.

Then animate exactly that roll.

## Guided first attack

Create a teaching sequence:

### Step 1: Roll to hit
> Roll the d20 because you are attempting to hit the target.

Animate d20.

### Step 2: Add your attack modifier
> Your character is trained and capable, so the raw die roll is not the whole story.

Show modifier components.

### Step 3: Compare to Armor Class
> If the total meets or beats the target's AC, the attack hits.

### Step 4: Roll damage
> Now that we know the hit happened, roll the weapon's damage die.

Animate damage die.

### Step 5: Add damage modifier
Show final damage.

This should become one of Ember & Stone's earliest interactive lessons.

## Guided saving throw

Teach:

> Something is happening **to you**. The game asks whether your character resists, avoids, or endures it.

Example:
- dragon breath;
- poison;
- spell;
- trap;
- falling debris.

Animate:
```
d20 + saving throw modifier vs DC
```

Then explain:
- success may mean no effect;
- half damage;
- reduced effect;
- shorter duration;
- or whatever the specific rule says.

Do not imply all saves work identically.

## Guided ability check

Teach:

> You are trying to do something uncertain and the DM decides a roll is needed.

Examples:
- climb a wall;
- search a room;
- convince a guard;
- sneak past someone.

Animate:
```
d20 + ability modifier + proficiency if applicable
```

## Natural 1 and natural 20

Teach carefully.

Do not teach that a natural 1 or natural 20 automatically controls every d20 test.

Explain:
- attack rolls have special natural 1/natural 20 behavior;
- death saves have special natural 1/natural 20 behavior;
- ability checks and saving throws should follow the actual applicable rules instead of importing attack-roll assumptions.

## Advantage and disadvantage visualizer

Show two d20s rolling together.

Advantage:
> Roll two d20s and use the higher result.

Disadvantage:
> Roll two d20s and use the lower result.

The animation should visibly discard the unused die.

## Probability view

Beginner:
> A d20 has 20 equally likely results.

Advanced:
- probability of hitting a target AC;
- expected value;
- advantage/disadvantage probability;
- damage averages;
- multiple dice curves.

Iron Pit can later connect to these deeper simulations.

## Sound and accessibility

Dice animation should not be required to understand the result.

Support:
- reduced motion;
- keyboard roll;
- screen-reader result announcements;
- captions/text for sound cues;
- optional dice sounds;
- clear result history.

## Ember & Stone integration

Each dice lesson should connect to:
- matching YouTube video;
- written lesson;
- interactive dice demo;
- CharacterForge field;
- Hearthford scene;
- Iron Pit lab.

Suggested early video/lesson topics:
- What is a d20?
- What does 2d6 mean?
- Attack roll vs damage roll.
- What is a saving throw?
- What is a DC?
- Advantage and disadvantage.
- Why some weapons use different dice.
- Natural 1s and natural 20s.
- How modifiers work.
- How proficiency works.

## Success criterion

A complete beginner should leave the first dice lesson understanding:

1. **d20 usually answers: did I succeed?**
2. **other dice often answer: how much happened?**
3. **the number after d tells you how many sides the die has.**
4. **2d6 means two six-sided dice.**
5. **modifiers represent the character, not the die.**
6. **the result is usually compared to a target number.**

That mental model comes first. Rules precision is layered on top as the learner advances.
