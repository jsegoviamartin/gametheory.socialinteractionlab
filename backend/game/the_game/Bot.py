import random

def make_bot_decision(player_history, bot_history, label_a, label_b):
    """
    Probabilistic Tit-for-Tat or similar strategies based on researcher-defined labels.
    """
    
    actionA, actionB = label_a, label_b

    if not player_history:
        # First round: choose Action A (Cooperate/Bach/Stag)
        return actionA

    # 10 % exploration
    if random.random() < 0.10:
        return random.choice([actionA, actionB])

    last_human = player_history[-1]

    # Simple Tit-for-Tat like behavior
    if last_human == actionB: # Human "defected" or chose second option
        return actionB if random.random() < 0.70 else actionA
    else: # Human "cooperated" or chose first option
        return actionA if random.random() < 0.70 else actionB
