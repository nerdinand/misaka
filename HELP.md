Command Help
============

If you are looking for the commands for lumi's game, go [here](#mod_rawr).

## Common commands

- [mod_derpibooru](#mod_derpibooru) - !derpi
- [mod_mediawiki](#mod_mediawiki) - !wiki
- [mod_plugdj](#mod_plugdj) - !dj, !song, !songurl


## Commands sorted by module

- [mod_derpibooru](#mod_derpibooru)
- [mod_lumineko](#mod_lumineko)
- [mod_mediawiki](#mod_mediawiki)
- [mod_plugdj](#mod_plugdj)
- [mod_rawr](#mod_rawr)


### mod_derpibooru

| Command  | Description
| -------- | -----------------------------------
| derpi    | Get a random image from derpiboo.ru

`!derpi` by itself will get a random safe image.

`!derpi applejack, twilight sparkle` will get a random image with the tags `applejack` and
`twilight sparkle`.


### mod_lumineko

| Command         | Description
| --------------- | --------------------------------------------------------------
| challenge       | Post 30 minute challenge information, or turn reminders on/off
| donate          | Post donation info
| sketchraffle    | Post sketch raffle info
| streamtipraffle | Post stream tip raffle info

`!challenge on` will turn challenge reminders on, `!challenge off` will turn them off (channel
admin and mod only).


### mod_mediawiki

| Command | Description
| ------- | ------------------------------------------
| wiki    | Get basic wiki information on some subject

`!wiki cat` will get basic information about cats from Wikipedia.


### mod_plugdj

| Command    | Description
| ---------- | -------------------------
| dj         | Get the current dj
| song       | Get the current song name
| songurl    | Get the current song url
| video      | Alias for song
| videourl   | Alias for songurl


### mod_rawr

| Command  | Description
| -------- | ---------------------------------------------------------------------------
| gg       | Starts a guessing game (whisper only, channel admin only)
| ggend    | End an ongoing game early, without awarding points (channel admin only)
| ggex     | Exempt a user from the current game (channel admin only)
| guess    | Make a guess during the game
| ggrules  | Link to the game rules
| ggticket | Whispers a list of all users who have an unused ticket (channel admin only)
| mark     | Mark a user's unused ticket as used (channel admin only)
| rp       | Whisper back the user's RAWR point total
| rpgive   | Give a user RAWR points (channel admin only)
| rpredeem | Purchase a RAWR ticket

`!gg Some Character, Alternate Character Name` starts a guessing game with two possible answers.

`!ggex user123` will exempt user123 from the current game, not allowing them to guess.

`!guess some character` performs a (case-insensitive) guess of "some character." Can be whispered.

`!mark user123` marks user123's unused ticket as used, if they have an unused ticket.

`!rpgive user123 20` will give user123 20 RAWR points if they are in the room.
