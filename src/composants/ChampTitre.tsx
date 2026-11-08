'use client'
// Le titre de l'éditeur de blocs : une zone de texte qui grandit avec lui, pour qu'un long titre passe à la ligne
// comme dans WordPress, là où le champ <input> de Payload le coupait. Il reste sur une seule ligne logique.
import { getTranslation } from '@payloadcms/translations'
import { FieldError, FieldLabel, useField, useTranslation } from '@payloadcms/ui'
import type { TextFieldClientComponent, Validate } from 'payload'
import { useCallback, useLayoutEffect, useRef } from 'react'

const ChampTitre: TextFieldClientComponent = ({ field, path: chemin, readOnly, validate }) => {
  const { i18n } = useTranslation()
  const { maxLength, minLength, required } = field
  const valider: Validate = useCallback(
    (valeur, options) => validate?.(valeur, { ...options, maxLength, minLength, required } as Parameters<NonNullable<typeof validate>>[1]) ?? true,
    [validate, maxLength, minLength, required],
  )
  const { value, setValue, showError, errorMessage, disabled, path } = useField<string>({ potentiallyStalePath: chemin, validate: valider })
  const id = `field-${path.replace(/\./g, '__')}`
  const zone = useRef<HTMLTextAreaElement>(null)

  // Hauteur ajustée au texte à chaque frappe et quand la largeur change (field-sizing n'existe pas encore partout).
  useLayoutEffect(() => {
    const el = zone.current
    if (!el) return
    const ajuster = () => {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
    ajuster()
    window.addEventListener('resize', ajuster)
    return () => window.removeEventListener('resize', ajuster)
  }, [value])

  const placeholder = field.admin?.placeholder

  return (
    <div className={`field-type text${showError ? ' error' : ''}`}>
      <FieldLabel htmlFor={id} label={field.label} localized={field.localized} path={path} required={required} />
      <FieldError message={errorMessage} path={path} showError={showError} />
      <textarea
        ref={zone}
        id={id}
        name={path}
        rows={1}
        value={value ?? ''}
        placeholder={placeholder ? getTranslation(placeholder, i18n) : undefined}
        disabled={readOnly || disabled}
        // Entrée ne crée pas de ligne : un titre n'en a qu'une, le retour à la ligne n'est qu'affichage.
        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
        onChange={(e) => setValue(e.target.value.replace(/\s*\n\s*/g, ' '))}
      />
    </div>
  )
}

export default ChampTitre
