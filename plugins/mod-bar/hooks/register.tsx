import type { Register } from 'claude-code'

export const register: Register = (on, options) => {
  const names = String(options.shortcuts ?? 'progress,relais')
    .split(',')
    .map(s => s.trim().replace(/^\//, ''))
    .filter(Boolean)

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || names.length === 0) {
      return next(e)
    }

    const { Box, Text, Button } = $.ui.resolve(e)

    return (
      <Box gap={1} paddingX={1}>
        <Text dimColor>Mods</Text>
        {names.map(name => (
          <Box key={`frame-${name}`} borderStyle="round" paddingX={1}>
            <Button
              key={`mod-${name}`}
              label={`/${name}`}
              onPress={() => {
                // A command can take long (/relais asks the model): the press
                // returns at once and the answer is logged when it comes.
                $.ui.toast(`/${name}…`)
                void $.command
                  .run({ command: name })
                  .then(r => {
                    if (r.text) $.ui.log(r.text)
                  })
                  .catch(() => $.ui.toast(`/${name} a échoué`))
              }}
            />
          </Box>
        ))}
      </Box>
    )
  })
}
