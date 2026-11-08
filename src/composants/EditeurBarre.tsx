'use client'
// La barre supérieure de l'éditeur de blocs : retour, insertion, annuler et rétablir, titre au centre, enregistrement à droite.
import { PublishButton, SaveDraftButton, useAuth, useConfig, useDocumentInfo, useFormFields, useLocale } from '@payloadcms/ui'
import { $createParagraphNode, $getRoot, type LexicalEditor, REDO_COMMAND, UNDO_COMMAND } from '@payloadcms/richtext-lexical/lexical'
import { useState } from 'react'

import { libelle, reglagesEditeur } from './outils.js'

const editeur = () => (document.querySelector('[data-lexical-editor]') as (HTMLElement & { __lexicalEditor?: LexicalEditor }) | null)?.__lexicalEditor

// Ouvre le menu de blocs : le même que celui du « / » tapé dans le texte.
function insererBloc() {
  const e = editeur()
  if (!e) return
  e.update(() => {
    const racine = $getRoot()
    const dernier = racine.getLastChild()
    const paragraphe = dernier?.getType() === 'paragraph' && dernier.getTextContent() === '' ? dernier : $createParagraphNode()
    if (paragraphe !== dernier) racine.append(paragraphe)
    ;(paragraphe as ReturnType<typeof $createParagraphNode>).select().insertText('/')
  })
  e.focus()
}

const Icone = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d={d} /></svg>
)

export default function EditeurBarre() {
  const { hasPublishedDoc, collectionSlug } = useDocumentInfo()
  const contributeur = (useAuth().user as { role?: string } | null)?.role === 'contributor' // il enregistre, un éditeur publie
  const { config } = useConfig()
  const { label } = useLocale()
  const collection = config.collections.find((c) => c.slug === collectionSlug)
  const champTitre = reglagesEditeur(collection)?.titre ?? 'title'
  const nom = libelle(collection?.labels?.singular, collectionSlug ?? '')
  const liste = `/admin/collections/${collectionSlug}`
  const titre = useFormFields(([f]) => f[champTitre]?.value as string | undefined)
  const [panneau, setPanneau] = useState(true)
  const langue = libelle(label, '')

  const basculer = () => {
    document.documentElement.dataset.wpPanneau = panneau ? 'ferme' : 'ouvert'
    setPanneau(!panneau)
  }

  return (
    <>
      <div className="wpe-barre" role="toolbar" aria-label="Outils de l'éditeur">
        <div className="wpe-barre__gauche">
          <a className="wpe-icone" href={liste} aria-label={`Retour : ${libelle(collection?.labels?.plural, nom).toLowerCase()}`}>
            <Icone d="M14.6 7l-1.2-1L8 12l5.4 6 1.2-1-4.6-5z" />
          </a>
          <button type="button" className="wpe-icone wpe-icone--ajout" aria-label="Ajouter un bloc" onClick={insererBloc}>
            <Icone d="M11 12.5V17.5H12.5V12.5H17.5V11H12.5V6H11V11H6V12.5H11Z" />
          </button>
          <button type="button" className="wpe-icone" aria-label="Annuler" onClick={() => editeur()?.dispatchCommand(UNDO_COMMAND, undefined)}>
            <Icone d="M18.3 11.7c-.6-.6-1.4-.9-2.3-.9H6.7l2.9-3.3-1.1-1-4.5 5L8.5 16l1-1-2.7-2.7H16c.5 0 .9.2 1.3.5 1 1 1 3.4 1 4.5v.3h1.5v-.2c0-1.5 0-4.3-1.5-5.7z" />
          </button>
          <button type="button" className="wpe-icone" aria-label="Rétablir" onClick={() => editeur()?.dispatchCommand(REDO_COMMAND, undefined)}>
            <Icone d="M15.6 6.5l-1.1 1 2.9 3.3H8c-.9 0-1.7.3-2.3.9-1.4 1.5-1.4 4.2-1.4 5.6v.2h1.5v-.3c0-1.1 0-3.5 1-4.5.3-.3.7-.5 1.3-.5h9.2L15 15l1 1 4.5-4.5-4.9-5z" />
          </button>
        </div>
        <button type="button" className="wpe-barre__titre" onClick={() => document.querySelector<HTMLInputElement>(`#field-${champTitre}`)?.focus()}>
          <span>{titre || 'Aucun titre'}</span> · {nom}{langue && ` · ${langue}`}
        </button>
        <div className="wpe-barre__droite">
          <div className="wpe-barre__brouillon"><SaveDraftButton /></div>
          <button type="button" className={panneau ? 'wpe-icone wpe-icone--actif' : 'wpe-icone'} aria-label="Réglages" aria-pressed={panneau} onClick={basculer}>
            <Icone d="M18 4H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM6 5.5h7v13H6c-.3 0-.5-.2-.5-.5V6c0-.3.2-.5.5-.5zm12.5 12.5c0 .3-.2.5-.5.5h-3.5v-13H18c.3 0 .5.2.5.5v12z" />
          </button>
          {!contributeur && <div className="wpe-barre__publier"><PublishButton label={hasPublishedDoc ? 'Enregistrer' : 'Publier'} /></div>}
        </div>
      </div>
      <div className="wpe-pied">{nom}</div>
    </>
  )
}
