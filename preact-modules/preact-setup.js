import { h, render, Component, createContext, cloneElement } from './lib/preact.module.js';
import { useState, useReducer, useEffect, useLayoutEffect, useRef, useMemo, useCallback, useContext } from './lib/preact-hooks.module.js';
import htm from './lib/htm.module.js';

// Bind htm to h
const html = htm.bind(h);

export {
  h,
  render,
  Component,
  createContext,
  cloneElement,
  useState,
  useReducer,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useCallback,
  useContext,
  html
};
