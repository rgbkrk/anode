# Livestore Introduction

Livestore is a javascript library which is designed for frontends to emit events into an event log. These events are then reduced (or materialized) into a local sqlite database, where there are bindings to let the UI to know when and how to re-draw. So far, this should sound somewhat like redux or zustand. However, keeping the whole event log as the source of truth is important for Livestore, because it additionally enables syncing and conflict resolution of events across multiple clients. Livestore additionally provides a sync handler to take all of these events from multiple clients to produce a single, merged source of truth for events.

# Event sourcing

A livestore event is [schema-based](https://docs.livestore.dev/reference/state/sqlite-schema/), describing what events can be triggered and the payload they need to have. You can see the current schema for anode [here](https://github.com/runtimed/runt/blob/main/packages/schema/mod.ts)

This is made simple by LiveStore's react bindings, so the code looks like `const { store } = useStore();` and then `store.commit(event)`. These events are then run through any `materializers` hooks on the store side to compute derived state (so far we haven't needed this). Finally, there's a `useQuery` selector to get the data out of the database, notify the component when things change, and then render the state

# Syncing

You can use a github metaphor for thinking about how this works with multiple clients. Imagine that every event is a commit. When you want to update your changes to the central document store, the code will:

1. Do a git pull to grab all of the latest changes
2. Rebase the local event log on top of the latest changes
3. Do a git push to send the new events

So there's a few things that can happen here. What happens if the rebase operation produces merge conflicts? That's a great question and it hasn't [been implemented yet](https://docs.livestore.dev/reference/syncing/#merge-conflicts)
Then, what happens if someone else does a git push in between steps 2 and 3? In this case the document server will reject the slower client, and that client will have to repeat the operations all over again.

This has the downside that although the system as a whole makes progress (since some push always wins), there's no guarantee a particular client will make progress

# More info

- [React getting started](https://docs.livestore.dev/getting-started/expo/)
- [Livestore vs redux](https://docs.livestore.dev/evaluation/technology-comparison/#livestore-vs-redux)
- [Thinking about event logs](https://engineering.linkedin.com/distributed-systems/log-what-every-software-engineer-should-know-about-real-time-datas-unifying)
- [Syncing diagrams](https://docs.livestore.dev/reference/syncing/#advanced)
